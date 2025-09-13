"""配置管理模块"""
import os
from typing import Optional


class Config:
    """应用配置类"""

    # TEI 服务配置
    TEI_URL: str = os.getenv("TEI_URL", "http://tei:80")
    TEI_BATCH_SIZE: int = int(os.getenv("TEI_BATCH", os.getenv("TEI_BATCH_SIZE", "32")))

    # Qdrant 配置
    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://qdrant:6333")
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "subtitles")
    VECTOR_SIZE: int = int(os.getenv("VECTOR_DIM", "384"))
    QDRANT_DISTANCE: str = (os.getenv("QDRANT_DISTANCE", "Cosine")).upper()

    # SRT 摄入配置
    SUBTITLES_DIR: str = os.getenv("SUBTITLES_DIR", "/data/subtitles")

    # 随机功能配置
    RANDOM_SEARCH_LIMIT: int = 50
    RANDOM_MAX_RETRIES: int = 20
    RANDOM_MIN_WORDS: int = 3
    RANDOM_FALLBACK_BATCH_SIZE: int = 100


def ensure_no_proxy_for_local(url: str) -> None:
    """确保本地服务绕过HTTP代理"""
    try:
        from urllib.parse import urlparse

        host = urlparse(url).hostname or ""
        if host in {"localhost", "127.0.0.1", "::1"}:
            existing = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
            items = {h.strip() for h in existing.split(",") if h.strip()}
            items.update({"localhost", "127.0.0.1", "::1"})
            merged = ",".join(sorted(items))
            os.environ["NO_PROXY"] = merged
            os.environ["no_proxy"] = merged
    except Exception:
        # Best-effort; ignore if anything goes wrong
        pass


# 应用启动时设置代理配置
ensure_no_proxy_for_local(Config.TEI_URL)
ensure_no_proxy_for_local(Config.QDRANT_URL)

# 导出配置实例
config = Config()
