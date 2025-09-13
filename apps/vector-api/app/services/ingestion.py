"""SRT文件摄入服务"""
import os
import re
from typing import Dict, Any, List
from qdrant_client.http import models as qm

from ..config import config
from ..utils import normalize_text, parse_srt_time, safe_point_id, log_operation
from .database import qdrant_service
from .embedding import embedding_service


class IngestionService:
    """SRT文件摄入服务类"""

    def __init__(self):
        self.job_status: Dict[str, Any] = {
            "running": False,
            "total": 0,
            "upserted": 0,
            "errors": 0,
            "dir": None
        }

    def get_status(self) -> Dict[str, Any]:
        """获取摄入任务状态"""
        return self.job_status

    async def ingest_directory(self, dir_path: str) -> None:
        """摄入指定目录的所有SRT文件"""

        # 初始化任务状态
        self.job_status.update({
            "running": True,
            "total": 0,
            "upserted": 0,
            "errors": 0,
            "dir": dir_path
        })

        try:
            # 扫描SRT文件
            srt_files = [f for f in os.listdir(dir_path) if f.endswith(".srt")]
            self.job_status["total"] = len(srt_files)

            log_operation("ingest_start", {
                "dir": dir_path,
                "files": len(srt_files)
            })

            # 确保集合存在
            await qdrant_service.ensure_collection()

            # 处理每个文件
            for filename in srt_files:
                try:
                    await self._process_srt_file(dir_path, filename)
                except Exception as e:
                    self.job_status["errors"] += 1
                    log_operation("ingest_file_error", {
                        "file": filename,
                        "error": str(e)
                    }, "ERROR")
                    continue

            log_operation("ingest_complete", {
                "dir": dir_path,
                "upserted": self.job_status["upserted"],
                "errors": self.job_status["errors"]
            })

        finally:
            self.job_status["running"] = False

    async def _process_srt_file(self, dir_path: str, filename: str) -> None:
        """处理单个SRT文件"""
        file_path = os.path.join(dir_path, filename)

        # 解析文件名获取视频信息
        video_id, episode = self._parse_filename(filename)

        # 读取文件内容
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # 解析SRT内容
        entries = self._parse_srt_content(content, video_id, episode)

        if not entries:
            log_operation("srt_no_entries", {"file": filename})
            return

        # 生成嵌入向量
        texts = [entry["normalized_text"] or entry["text"] for entry in entries]
        embeddings = await embedding_service.embed_texts(texts, "raw")

        if len(embeddings) != len(entries):
            raise ValueError(f"Embedding count mismatch: {len(embeddings)} != {len(entries)}")

        # 创建Qdrant点
        points = []
        for entry, embedding in zip(entries, embeddings):
            point = qm.PointStruct(
                id=safe_point_id(entry["id"]),
                vector=embedding,
                payload=entry["payload"]
            )
            points.append(point)

        # 批量插入
        await qdrant_service.upsert_points(points)

        self.job_status["upserted"] += len(points)
        log_operation("srt_processed", {
            "file": filename,
            "points": len(points)
        })

    def _parse_filename(self, filename: str) -> tuple[str, int]:
        """从文件名解析视频ID和集数"""
        base = os.path.splitext(filename)[0]
        match = re.match(r"^(.*?)(?:_(\d+))?$", base)

        if match:
            video_id = match.group(1)
            episode = int(match.group(2)) if match.group(2) else 1
        else:
            video_id = base
            episode = 1

        return video_id, episode

    def _parse_srt_content(
        self,
        content: str,
        video_id: str,
        episode: int
    ) -> List[Dict[str, Any]]:
        """解析SRT文件内容"""
        lines = [line.strip() for line in content.splitlines()]
        entries = []

        # SRT解析状态机
        state = "seq"
        seq = None
        start_time = None
        end_time = None
        text_lines: List[str] = []

        def flush_block():
            """处理当前字幕块"""
            nonlocal seq, start_time, end_time, text_lines

            if seq is None or start_time is None or end_time is None:
                return

            text = " ".join(text_lines).strip()
            if not text:
                return

            normalized = normalize_text(text)
            entry_id = f"{video_id}_{episode}_{seq}"

            entry = {
                "id": entry_id,
                "text": text,
                "normalized_text": normalized,
                "payload": {
                    "video_id": video_id,
                    "episode": episode,
                    "sequence": seq,
                    "start_ms": start_time,
                    "end_ms": end_time,
                    "text": text,
                    "normalized_text": normalized,
                }
            }

            entries.append(entry)

            # 重置状态
            seq, start_time, end_time, text_lines = None, None, None, []

        # 处理每一行（包括空行作为结束标记）
        for line in lines + [""]:
            if line == "":
                flush_block()
                state = "seq"
                continue

            if state == "seq":
                if line.isdigit():
                    seq = int(line)
                    state = "time"
                continue

            elif state == "time":
                time_match = re.search(
                    r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})",
                    line
                )
                if time_match:
                    start_time = parse_srt_time(time_match.group(1))
                    end_time = parse_srt_time(time_match.group(2))
                    state = "text"
                continue

            elif state == "text":
                text_lines.append(line)

        return entries


# 全局摄入服务实例
ingestion_service = IngestionService()
