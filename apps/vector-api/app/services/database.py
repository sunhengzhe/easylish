"""Qdrant数据库服务"""
from typing import Optional, List, Any
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qm

from ..config import config
from ..utils import log_operation


class QdrantService:
    """Qdrant数据库服务类"""

    def __init__(self):
        self._client: Optional[AsyncQdrantClient] = None

    def get_client(self) -> AsyncQdrantClient:
        """获取Qdrant客户端"""
        if self._client is None:
            self._client = AsyncQdrantClient(url=config.QDRANT_URL)
        return self._client

    async def ensure_collection(self, collection_name: str = None) -> None:
        """确保集合存在"""
        client = self.get_client()
        collection_name = collection_name or config.QDRANT_COLLECTION

        try:
            await client.get_collection(collection_name)
        except Exception:
            await client.create_collection(
                collection_name=collection_name,
                vectors_config=qm.VectorParams(
                    size=config.VECTOR_SIZE,
                    distance=getattr(qm.Distance, config.QDRANT_DISTANCE, qm.Distance.COSINE),
                ),
            )
            log_operation("collection_created", {"collection": collection_name})

    async def get_collection_count(self, collection_name: str = None) -> int:
        """获取集合中的点数量"""
        client = self.get_client()
        collection_name = collection_name or config.QDRANT_COLLECTION

        try:
            count_result = await client.count(collection_name, exact=True)  # type: ignore
            return int(getattr(count_result, "count", 0))
        except Exception as e:
            log_operation("count_error", {"error": str(e)}, "ERROR")
            return 0

    async def search_vectors(
        self,
        query_vector: List[float],
        limit: int = 10,
        collection_name: str = None
    ) -> List[Any]:
        """向量搜索"""
        client = self.get_client()
        collection_name = collection_name or config.QDRANT_COLLECTION

        await self.ensure_collection(collection_name)

        results = await client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=max(1, min(100, limit)),
            with_payload=True,
        )

        return results

    async def upsert_points(
        self,
        points: List[qm.PointStruct],
        collection_name: str = None
    ) -> int:
        """批量插入点"""
        client = self.get_client()
        collection_name = collection_name or config.QDRANT_COLLECTION

        await self.ensure_collection(collection_name)
        await client.upsert(collection_name, points=points)

        log_operation("upsert", {
            "collection": collection_name,
            "points": len(points)
        })

        return len(points)

    async def scroll_collection(
        self,
        limit: int = 100,
        offset: Any = None,
        collection_name: str = None,
        with_vectors: bool = False
    ) -> tuple[List[Any], Any]:
        """滚动获取集合数据"""
        client = self.get_client()
        collection_name = collection_name or config.QDRANT_COLLECTION

        await self.ensure_collection(collection_name)

        scroll_result, next_page_token = await client.scroll(
            collection_name=collection_name,
            with_payload=True,
            with_vectors=with_vectors,
            limit=limit,
            offset=offset,
        )

        return scroll_result, next_page_token

    async def delete_points_by_filter(
        self,
        filter_condition: qm.Filter,
        collection_name: str = None
    ) -> None:
        """根据过滤条件删除点"""
        client = self.get_client()
        collection_name = collection_name or config.QDRANT_COLLECTION

        await client.delete(
            collection_name=collection_name,
            points_selector=qm.FilterSelector(filter=filter_condition)
        )

        log_operation("delete_by_filter", {"collection": collection_name})

    async def delete_points_by_ids(
        self,
        point_ids: List[Any],
        collection_name: str = None
    ) -> None:
        """根据ID删除点"""
        client = self.get_client()
        collection_name = collection_name or config.QDRANT_COLLECTION

        await client.delete(
            collection_name=collection_name,
            points_selector=qm.PointIdsList(points=point_ids)
        )

        log_operation("delete_by_ids", {
            "collection": collection_name,
            "count": len(point_ids)
        })


# 全局数据库服务实例
qdrant_service = QdrantService()
