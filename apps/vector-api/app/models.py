"""数据模型定义"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class UpsertEntry(BaseModel):
    """单条台词上传条目"""
    id: str
    text: str
    video_id: Optional[str] = None
    episode: Optional[int] = None


class UpsertRequest(BaseModel):
    """批量上传请求"""
    entries: List[UpsertEntry]
    format: Optional[str] = "raw"  # e5 | raw
    collection: Optional[str] = None  # override collection per request


class QueryRequest(BaseModel):
    """向量查询请求"""
    query: str
    top_k: int = 10
    format: Optional[str] = "raw"  # e5 | raw
    collection: Optional[str] = None  # override collection per request


class QueryResponseItem(BaseModel):
    """查询响应单项"""
    entryId: str
    score: float
    payload: Optional[Dict[str, Any]] = None


class RandomRequest(BaseModel):
    """随机台词请求"""
    collection: Optional[str] = None
    min_words: Optional[int] = 3  # 最少单词数


class DeleteRequest(BaseModel):
    """删除请求"""
    collection: Optional[str] = None
    video_ids: Optional[List[str]] = None
    video_id_prefix: Optional[str] = None


class IngestRequest(BaseModel):
    """SRT文件摄入请求"""
    dir: Optional[str] = None


class StatusResponse(BaseModel):
    """状态响应"""
    ok: bool
    collection: str
    count: int


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str
    details: Optional[str] = None
