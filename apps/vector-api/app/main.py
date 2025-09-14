"""Vector API 主应用模块 - 重构版本"""
from typing import List, Any
from fastapi import FastAPI, BackgroundTasks
from fastapi import HTTPException

from .config import config
from .models import (
    UpsertRequest, QueryRequest, QueryResponseItem, RandomRequest,
    DeleteRequest, IngestRequest, StatusResponse, ErrorResponse
)
from .services.database import qdrant_service
from .services.embedding import embedding_service
from .services.random import random_subtitle_service
from .services.ingestion import ingestion_service
from .utils import safe_point_id, normalize_text, log_operation
from qdrant_client.http import models as qm


# FastAPI 应用实例
app = FastAPI(title="Vector API", version="0.3.0")


@app.get("/status", response_model=StatusResponse)
async def get_status():
    """获取服务状态"""
    await qdrant_service.ensure_collection()
    count = await qdrant_service.get_collection_count()

    log_operation("status_check", {
        "collection": config.QDRANT_COLLECTION,
        "count": count
    })

    return StatusResponse(
        ok=True,
        collection=config.QDRANT_COLLECTION,
        count=count
    )


@app.post("/upsert")
async def upsert_entries(req: UpsertRequest):
    """批量上传台词数据"""
    # 过滤空文本
    entries = [e for e in req.entries if e.text and e.text.strip()]
    if not entries:
        return {"upserted": 0}

    collection_name = req.collection or config.QDRANT_COLLECTION
    text_format = "e5_passage" if (req.format or "e5") == "e5" else "raw"

    try:
        # 生成嵌入向量
        texts = [e.text for e in entries]
        vectors = await embedding_service.embed_texts(texts, text_format)

        # 创建Qdrant点
        points: List[qm.PointStruct] = []
        for entry, vector in zip(entries, vectors):
            try:
                normalized = normalize_text(entry.text)
            except Exception:
                normalized = entry.text.strip().lower()

            point = qm.PointStruct(
                id=safe_point_id(entry.id),
                vector=vector,
                payload={
                    "video_id": entry.video_id,
                    "episode": entry.episode,
                    "text": entry.text,
                    "normalized_text": normalized,
                }
            )
            points.append(point)

        # 批量插入
        upserted_count = await qdrant_service.upsert_points(points, collection_name)

        log_operation("upsert", {
            "entries": len(entries),
            "points": upserted_count,
            "collection": collection_name
        })

        return {"upserted": upserted_count}

    except Exception as e:
        log_operation("upsert_error", {"error": str(e)}, "ERROR")
        raise HTTPException(status_code=500, detail=f"Upsert failed: {str(e)}")


@app.post("/query")
async def query_vectors(req: QueryRequest) -> List[QueryResponseItem]:
    """向量查询台词"""
    if not req.query or not req.query.strip():
        return []

    collection_name = req.collection or config.QDRANT_COLLECTION
    text_format = "e5_query" if (req.format or "e5") == "e5" else "raw"

    try:
        # 生成查询向量
        query_vectors = await embedding_service.embed_texts([req.query], text_format)
        query_vector = query_vectors[0]

        # 执行向量搜索
        results = await qdrant_service.search_vectors(
            query_vector=query_vector,
            limit=req.top_k,
            collection_name=collection_name
        )

        # 格式化响应
        response_items = [
            QueryResponseItem(
                entryId=str(point.id),
                score=float(point.score or 0.0),
                payload=(point.payload or None),
            )
            for point in results
        ]

        log_operation("query", {
            "top_k": req.top_k,
            "got": len(results),
            "top_score": results[0].score if results else None,
            "collection": collection_name
        })

        return response_items

    except Exception as e:
        log_operation("query_error", {"error": str(e)}, "ERROR")
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


# ---------------- 随机台词功能 ----------------

@app.get("/random")
async def get_random_subtitle():
    """获取随机台词 (GET版本)"""
    try:
        result = await random_subtitle_service.get_random_subtitle()

        if not result:
            return {"error": "No random subtitle found"}

        return result

    except Exception as e:
        log_operation("random_error", {"error": str(e)}, "ERROR")
        return {"error": f"Random selection failed: {str(e)}"}


@app.post("/random")
async def get_random_subtitle_post(req: RandomRequest):
    """获取随机台词 (POST版本，支持参数配置)"""
    try:
        result = await random_subtitle_service.get_random_subtitle(
            collection_name=req.collection,
            min_words=req.min_words
        )

        if not result:
            return {"error": "No random subtitle found"}

        return result

    except Exception as e:
        log_operation("random_post_error", {"error": str(e)}, "ERROR")
        return {"error": f"Random selection failed: {str(e)}"}


# ---------------- 维护功能 ----------------

@app.post("/delete")
async def delete_points(req: DeleteRequest):
    """删除数据点"""
    collection_name = req.collection or config.QDRANT_COLLECTION

    try:
        await qdrant_service.ensure_collection(collection_name)

        deleted_count = 0

        # 按视频ID列表删除
        if req.video_ids:
            filter_condition = qm.Filter(
                must=[
                    qm.FieldCondition(
                        key="video_id",
                        match=qm.MatchAny(any=req.video_ids),
                    )
                ]
            )
            await qdrant_service.delete_points_by_filter(filter_condition, collection_name)

            log_operation("delete_by_video_ids", {
                "collection": collection_name,
                "video_ids_count": len(req.video_ids)
            })

            return {
                "deleted": None,
                "collection": collection_name,
                "by": "video_ids",
                "count_unknown": True
            }

        # 按前缀删除（需要扫描）
        if req.video_id_prefix:
            deleted_count = await _delete_by_prefix(collection_name, req.video_id_prefix)

            log_operation("delete_by_prefix", {
                "collection": collection_name,
                "prefix": req.video_id_prefix,
                "deleted": deleted_count
            })

            return {
                "deleted": deleted_count,
                "collection": collection_name,
                "by": "prefix"
            }

        return {"deleted": 0, "collection": collection_name}

    except Exception as e:
        log_operation("delete_error", {"error": str(e)}, "ERROR")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


async def _delete_by_prefix(collection_name: str, prefix: str) -> int:
    """根据视频ID前缀删除点"""
    deleted_count = 0
    next_page_token = None
    batch_ids: List[Any] = []

    while True:
        # 滚动获取数据
        scroll_result, next_page_token = await qdrant_service.scroll_collection(
            limit=1024,
            offset=next_page_token,
            collection_name=collection_name,
            with_vectors=False  # 删除操作不需要向量数据
        )

        # 筛选匹配前缀的点
        for point in scroll_result:
            try:
                payload = point.payload or {}
                video_id = str(payload.get("video_id") or "")

                if video_id.startswith(prefix):
                    batch_ids.append(point.id)

                    # 批量删除（避免内存占用过大）
                    if len(batch_ids) >= 512:
                        await qdrant_service.delete_points_by_ids(batch_ids, collection_name)
                        deleted_count += len(batch_ids)
                        batch_ids = []

            except Exception:
                continue

        if not next_page_token:
            break

    # 删除剩余的点
    if batch_ids:
        await qdrant_service.delete_points_by_ids(batch_ids, collection_name)
        deleted_count += len(batch_ids)

    return deleted_count


# ---------------- SRT摄入功能 ----------------

@app.post("/ingest")
async def start_ingest(req: IngestRequest, bg: BackgroundTasks):
    """开始SRT文件摄入任务"""
    dir_path = req.dir or config.SUBTITLES_DIR

    # 检查是否已有任务在运行
    status = ingestion_service.get_status()
    if status.get("running"):
        return {
            "accepted": False,
            "running": True,
            "dir": status.get("dir")
        }

    # 在后台启动摄入任务
    bg.add_task(ingestion_service.ingest_directory, dir_path)

    log_operation("ingest_started", {"dir": dir_path})

    return {"accepted": True, "dir": dir_path}


@app.get("/ingest/status")
async def get_ingest_status():
    """获取SRT摄入任务状态"""
    return ingestion_service.get_status()
