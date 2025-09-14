"""随机台词服务"""
import random
from typing import Optional, Dict, Any, List

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

        简单逻辑：随机挑选一条台词

        Args:
            collection_name: 集合名称
            min_words: 最少单词数

        Returns:
            随机台词数据或None
        """
        collection_name = collection_name or config.QDRANT_COLLECTION
        min_words = min_words or config.RANDOM_MIN_WORDS

        # 使用简单的随机选择逻辑
        result = await self._simple_random_selection(collection_name, min_words)
        if result:
            return result

        log_operation("random_failed", {
            "collection": collection_name,
            "min_words": min_words
        }, "ERROR")

        return None

    async def _simple_random_selection(
        self,
        collection_name: str,
        min_words: int
    ) -> Optional[Dict[str, Any]]:
        """最简单的随机选择：直接随机返回一条台词"""

        try:
            # 获取一批随机数据
            scroll_result, _ = await qdrant_service.scroll_collection(
                limit=config.RANDOM_FALLBACK_BATCH_SIZE,
                collection_name=collection_name,
                with_vectors=False
            )

            if not scroll_result:
                return None

            # 直接随机选择一条，不做质量检查
            random_point = random.choice(scroll_result)

            result = {
                "entryId": str(random_point.id),
                "score": 1.0,
                "payload": random_point.payload or {}
            }

            log_operation("random_success", {
                "collection": collection_name,
                "point_id": result["entryId"]
            })

            return result

        except Exception as e:
            log_operation("random_error", {"error": str(e)}, "ERROR")
            return None


# 全局随机台词服务实例
random_subtitle_service = RandomSubtitleService()
