"""工具函数模块"""
import re
import uuid
from typing import List, Any


def chunk_list(lst: List[str], n: int) -> List[List[str]]:
    """将列表分块"""
    return [lst[i: i + n] for i in range(0, len(lst), n)]


def format_text_for_embedding(text: str, kind: str) -> str:
    """格式化文本用于嵌入"""
    t = text.strip()
    if not t:
        return t
    if kind == "e5_query":
        return f"query: {t}"
    if kind == "e5_passage":
        return f"passage: {t}"
    return t


def safe_point_id(raw: Any) -> Any:
    """转换任意ID为Qdrant兼容的点ID (u64 或 UUID)
    - 如果是整数类型: 返回整数
    - 如果是UUID字符串: 返回字符串
    - 其他情况: 确定性映射到UUIDv5
    """
    try:
        # int-like
        if isinstance(raw, int):
            return raw
        s = str(raw)
        if s.isdigit():
            return int(s)
        # UUID-like
        try:
            u = uuid.UUID(s)
            return str(u)
        except Exception:
            pass
        # Map to stable UUIDv5
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"easylish:{s}"))
    except Exception:
        # Last resort: random UUID
        return str(uuid.uuid4())


def normalize_text(s: str) -> str:
    """标准化文本，保留单词字符和空格，合并多个空格"""
    # Python re不支持\p{L}/\p{N}; 使用\w with UNICODE对大多数语言来说足够了
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s, flags=re.UNICODE)
    return s.strip().lower()


def parse_srt_time(t: str) -> int:
    """解析SRT时间格式为毫秒
    格式: HH:MM:SS,mmm
    """
    hh, mm, rest = t.split(":", 2)
    ss, ms = rest.split(",", 1)
    return (int(hh) * 3600 + int(mm) * 60 + int(ss)) * 1000 + int(ms)


def validate_text_quality(text: str, normalized_text: str = "", min_words: int = 3) -> tuple[bool, int]:
    """验证文本质量

    Args:
        text: 原始文本
        normalized_text: 标准化文本（可选）
        min_words: 最少单词数

    Returns:
        (是否合格, 单词数)
    """
    target_text = normalized_text or text

    # 移除标点符号并分割单词
    words = re.sub(r"[^\w\s\u4e00-\u9fff]", " ", target_text, flags=re.UNICODE)
    words = re.sub(r"\s+", " ", words, flags=re.UNICODE).strip().split()
    words = [w for w in words if len(w) > 0]

    word_count = len(words)
    is_valid = word_count >= min_words

    return is_valid, word_count


def log_operation(operation: str, details: dict = None, level: str = "INFO") -> None:
    """统一的日志记录函数"""
    details_str = ""
    if details:
        details_items = [f"{k}={v}" for k, v in details.items()]
        details_str = " " + " ".join(details_items)

    print(f"[vector-api] {operation}{details_str}")
