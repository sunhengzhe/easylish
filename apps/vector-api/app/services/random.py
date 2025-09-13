"""随机台词服务"""
import random
from typing import Optional, Dict, Any

from ..config import config
from ..utils import validate_text_quality, log_operation
from .database import qdrant_service


class RandomSubtitleService:
    """随机台词服务类"""

    async def get_random_subtitle(
        self,
        collection_name: str = None,
        min_words: int = None
    ) -> Optional[Dict[str, Any]]:
        """获取随机台词

        Args:
            collection_name: 集合名称
            min_words: 最少单词数

        Returns:
            随机台词数据或None
        """
        collection_name = collection_name or config.QDRANT_COLLECTION
        min_words = min_words or config.RANDOM_MIN_WORDS

        # 首先尝试随机向量搜索方法
        result = await self._random_vector_search(collection_name, min_words)
        if result:
            return result

        # 回退到批量随机选择方法
        result = await self._random_fallback_method(collection_name, min_words)
        if result:
            return result

        log_operation("random_failed", {
            "collection": collection_name,
            "min_words": min_words
        }, "ERROR")

        return None

    async def _random_vector_search(
        self,
        collection_name: str,
        min_words: int
    ) -> Optional[Dict[str, Any]]:
        """使用随机向量搜索方法获取随机台词"""

        for retry_count in range(config.RANDOM_MAX_RETRIES):
            try:
                # 生成随机向量
                random_vector = [
                    random.uniform(-1, 1)
                    for _ in range(config.VECTOR_SIZE)
                ]

                # 搜索
                search_results = await qdrant_service.search_vectors(
                    query_vector=random_vector,
                    limit=config.RANDOM_SEARCH_LIMIT,
                    collection_name=collection_name
                )

                if not search_results:
                    continue

                # 随机选择结果并验证质量
                for _ in range(min(10, len(search_results))):  # 最多尝试10个结果
                    random_index = random.randint(0, len(search_results) - 1)
                    point = search_results[random_index]

                    result = await self._validate_and_format_result(
                        point, min_words, retry_count, len(search_results)
                    )

                    if result:
                        log_operation("random_success_vector", {
                            "collection": collection_name,
                            "method": "vector_search",
                            "retries": retry_count,
                            "index": f"{random_index}/{len(search_results)}"
                        })
                        return result

            except Exception as e:
                log_operation("random_vector_error", {
                    "retry": retry_count,
                    "error": str(e)
                }, "ERROR")
                continue

        return None

    async def _random_fallback_method(
        self,
        collection_name: str,
        min_words: int
    ) -> Optional[Dict[str, Any]]:
        """回退方法：批量获取数据然后随机选择"""

        try:
            scroll_result, _ = await qdrant_service.scroll_collection(
                limit=config.RANDOM_FALLBACK_BATCH_SIZE,
                collection_name=collection_name
            )

            if not scroll_result:
                return None

            # 尝试多次随机选择
            for attempt in range(10):
                random_point = random.choice(scroll_result)

                result = await self._validate_and_format_result(
                    random_point, min_words, attempt, len(scroll_result)
                )

                if result:
                    log_operation("random_success_fallback", {
                        "collection": collection_name,
                        "method": "fallback_batch",
                        "attempt": attempt,
                        "batch_size": len(scroll_result)
                    })
                    return result

        except Exception as e:
            log_operation("random_fallback_error", {"error": str(e)}, "ERROR")

        return None

    async def _validate_and_format_result(
        self,
        point: Any,
        min_words: int,
        retry_info: int,
        total_info: int
    ) -> Optional[Dict[str, Any]]:
        """验证并格式化结果"""
        try:
            payload = point.payload or {}
            text = str(payload.get("text", ""))
            normalized_text = str(payload.get("normalized_text", ""))

            # 验证文本质量
            is_valid, word_count = validate_text_quality(
                text, normalized_text, min_words
            )

            if is_valid:
                return {
                    "entryId": str(point.id),
                    "score": 1.0,
                    "payload": payload
                }
            else:
                log_operation("random_text_rejected", {
                    "text_preview": text[:50] + "...",
                    "word_count": word_count,
                    "min_required": min_words
                })

        except Exception as e:
            log_operation("random_validation_error", {"error": str(e)}, "ERROR")

        return None


# 全局随机台词服务实例
random_subtitle_service = RandomSubtitleService()
