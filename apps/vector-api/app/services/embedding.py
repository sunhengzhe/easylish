"""文本嵌入服务"""
from typing import List
import httpx
from fastapi import HTTPException

from ..config import config
from ..utils import chunk_list, format_text_for_embedding, log_operation


class EmbeddingService:
    """文本嵌入服务类"""

    async def embed_texts(self, texts: List[str], text_format: str = "raw") -> List[List[float]]:
        """批量生成文本嵌入

        Args:
            texts: 待嵌入的文本列表
            text_format: 文本格式 ('raw', 'e5_query', 'e5_passage')

        Returns:
            嵌入向量列表
        """
        if not texts:
            return []

        # 格式化文本
        formatted_texts = [
            format_text_for_embedding(text, text_format)
            for text in texts
        ]

        out: List[List[float]] = []

        async with httpx.AsyncClient(timeout=60) as http:
            # 分批处理以避免请求过大
            for chunk in chunk_list(formatted_texts, max(1, config.TEI_BATCH_SIZE)):
                try:
                    embeddings = await self._embed_chunk(http, chunk)
                    out.extend(embeddings)
                except Exception as e:
                    log_operation("embed_error", {"error": str(
                        e), "chunk_size": len(chunk)}, "ERROR")
                    raise

        log_operation("embed_texts", {
            "total_texts": len(texts),
            "format": text_format,
            "total_vectors": len(out)
        })

        return out

    async def _embed_chunk(self, http_client: httpx.AsyncClient, texts: List[str]) -> List[List[float]]:
        """处理单个文本块的嵌入"""
        payload = {"inputs": texts}

        try:
            response = await http_client.post(f"{config.TEI_URL}/embed", json=payload)

            if response.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"TEI embedding error: {response.text}"
                )

            data = response.json()
            embeddings = self._parse_embedding_response(data)

            if len(embeddings) != len(texts):
                raise HTTPException(
                    status_code=502,
                    detail=f"Embedding count mismatch: expected {len(texts)}, got {len(embeddings)}"
                )

            return embeddings

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"TEI service connection error: {str(e)}"
            )

    def _parse_embedding_response(self, data: any) -> List[List[float]]:
        """解析TEI服务的嵌入响应"""
        embeddings = None

        if isinstance(data, list):
            if data and isinstance(data[0], list):
                embeddings = data
            else:
                embeddings = [
                    d.get("embedding")
                    for d in data
                    if isinstance(d, dict) and d.get("embedding")
                ]
        elif isinstance(data, dict):
            if isinstance(data.get("embeddings"), list):
                embeddings = data["embeddings"]
            elif isinstance(data.get("data"), list):
                if data["data"] and isinstance(data["data"][0], list):
                    embeddings = data["data"]
                else:
                    embeddings = [
                        d.get("embedding")
                        for d in data["data"]
                        if isinstance(d, dict) and d.get("embedding")
                    ]
            elif isinstance(data.get("embedding"), list):
                embeddings = [data["embedding"]]

        if not isinstance(embeddings, list):
            raise HTTPException(status_code=502, detail="Invalid TEI response format")

        return embeddings


# 全局嵌入服务实例
embedding_service = EmbeddingService()
