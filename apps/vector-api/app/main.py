import os
from typing import List, Optional, Dict, Any
import uuid

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qm


TEI_URL = os.getenv("TEI_URL", "http://tei:80")
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
COLLECTION = os.getenv("QDRANT_COLLECTION", "subtitles")
VECTOR_SIZE = int(os.getenv("VECTOR_DIM", "384"))
DISTANCE = (os.getenv("QDRANT_DISTANCE", "Cosine")).upper()
TEI_BATCH = int(os.getenv("TEI_BATCH", os.getenv("TEI_BATCH_SIZE", "32")))


# Ensure local services bypass HTTP proxies, if any are set in env
def _ensure_no_proxy_for_local(url: str) -> None:
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


_ensure_no_proxy_for_local(TEI_URL)
_ensure_no_proxy_for_local(QDRANT_URL)


class UpsertEntry(BaseModel):
    id: str
    text: str
    video_id: Optional[str] = None
    episode: Optional[int] = None


class UpsertRequest(BaseModel):
    entries: List[UpsertEntry]
    format: Optional[str] = "raw"  # e5 | raw
    collection: Optional[str] = None  # override collection per request


class QueryRequest(BaseModel):
    query: str
    top_k: int = 10
    format: Optional[str] = "raw"  # e5 | raw
    collection: Optional[str] = None  # override collection per request


class QueryResponseItem(BaseModel):
    entryId: str
    score: float
    payload: Optional[Dict[str, Any]] = None


app = FastAPI(title="Vector API", version="0.2.0")

_qdrant: Optional[AsyncQdrantClient] = None


def qdrant() -> AsyncQdrantClient:
    global _qdrant
    if _qdrant is None:
        _qdrant = AsyncQdrantClient(url=QDRANT_URL)
    return _qdrant


async def ensure_collection(client: AsyncQdrantClient):
    try:
        await client.get_collection(COLLECTION)
    except Exception:
        await client.create_collection(
            collection_name=COLLECTION,
            vectors_config=qm.VectorParams(
                size=VECTOR_SIZE,
                distance=getattr(qm.Distance, DISTANCE, qm.Distance.COSINE),
            ),
        )


def _chunk(lst: List[str], n: int) -> List[List[str]]:
    return [lst[i : i + n] for i in range(0, len(lst), n)]


def _fmt(text: str, kind: str) -> str:
    t = text.strip()
    if not t:
        return t
    if kind == "e5_query":
        return f"query: {t}"
    if kind == "e5_passage":
        return f"passage: {t}"
    return t


def _safe_point_id(raw: Any) -> Any:
    """Convert arbitrary id to Qdrant-compatible point id (u64 or UUID).
    - If int-like: return int
    - If UUID-like string: return string as-is
    - Else: deterministically map to UUIDv5 using NAMESPACE_URL
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


async def tei_embed(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    out: List[List[float]] = []
    async with httpx.AsyncClient(timeout=60) as http:
        for chunk in _chunk(texts, max(1, TEI_BATCH)):
            payload = {"inputs": chunk}
            r = await http.post(f"{TEI_URL}/embed", json=payload)
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail=f"TEI error: {r.text}")
            data = r.json()
            # Normalize outputs
            embs = None
            if isinstance(data, list):
                if data and isinstance(data[0], list):
                    embs = data
                else:
                    embs = [d.get("embedding") for d in data if isinstance(d, dict) and d.get("embedding")]
            elif isinstance(data, dict):
                if isinstance(data.get("embeddings"), list):
                    embs = data["embeddings"]
                elif isinstance(data.get("data"), list):
                    if data["data"] and isinstance(data["data"][0], list):
                        embs = data["data"]
                    else:
                        embs = [d.get("embedding") for d in data["data"] if isinstance(d, dict) and d.get("embedding")]
                elif isinstance(data.get("embedding"), list):
                    embs = [data["embedding"]]
            if not isinstance(embs, list):
                raise HTTPException(status_code=502, detail="Invalid TEI response")
            out.extend(embs)
    return out


@app.get("/status")
async def status():
    c = qdrant()
    await ensure_collection(c)
    # count points
    count = 0
    try:
        cres = await c.count(COLLECTION, exact=True)  # type: ignore
        count = int(getattr(cres, "count", 0))
    except Exception:
        pass
    print(f"[vector-api] status collection={COLLECTION} count={count}")
    return {"ok": True, "collection": COLLECTION, "count": count}


@app.post("/upsert")
async def upsert(req: UpsertRequest):
    entries = [e for e in req.entries if e.text and e.text.strip()]
    if not entries:
        return {"upserted": 0}
    kind = "e5_passage" if (req.format or "e5") == "e5" else "raw"
    texts = [_fmt(e.text, kind) for e in entries if e.text]
    vectors = await tei_embed(texts)
    if len(vectors) != len(entries):
        raise HTTPException(status_code=502, detail="Embedding length mismatch")
    c = qdrant()
    coll = (req.collection or COLLECTION)
    # ensure target collection exists
    try:
        await c.get_collection(coll)
    except Exception:
        await c.create_collection(
            collection_name=coll,
            vectors_config=qm.VectorParams(
                size=VECTOR_SIZE,
                distance=getattr(qm.Distance, DISTANCE, qm.Distance.COSINE),
            ),
        )
    points: List[qm.PointStruct] = []
    for e, v in zip(entries, vectors):
        # include text payload to allow clients/tests to reconstruct entries from search hits
        try:
            norm = _normalize_text(e.text)
        except Exception:
            norm = e.text.strip().lower()
        points.append(
            qm.PointStruct(
                id=_safe_point_id(e.id),
                vector=v,
                payload={
                    "video_id": e.video_id,
                    "episode": e.episode,
                    "text": e.text,
                    "normalized_text": norm,
                },
            )
        )
    await c.upsert(coll, points=points)
    print(f"[vector-api] upsert entries={len(entries)} points={len(points)} collection={coll}")
    return {"upserted": len(points)}


@app.post("/query")
async def query(req: QueryRequest) -> List[QueryResponseItem]:
    if not req.query or not req.query.strip():
        return []
    kind = "e5_query" if (req.format or "e5") == "e5" else "raw"
    qvec = (await tei_embed([_fmt(req.query, kind)]))[0]
    c = qdrant()
    coll = (req.collection or COLLECTION)
    await ensure_collection(c)
    res = await c.search(
        collection_name=coll,
        query_vector=qvec,
        limit=max(1, min(100, req.top_k)),
        with_payload=True,
    )
    print(
        f"[vector-api] query top_k={req.top_k} got={len(res)} top_score={(res[0].score if res else None)} collection={coll}"
    )
    return [
        QueryResponseItem(
            entryId=str(p.id),
            score=float(p.score or 0.0),
            payload=(p.payload or None),
        )
        for p in res
    ]

# ---------------- Maintenance ----------------

class DeleteRequest(BaseModel):
    collection: Optional[str] = None
    video_ids: Optional[List[str]] = None
    video_id_prefix: Optional[str] = None


@app.post("/delete")
async def delete_points(req: DeleteRequest):
    c = qdrant()
    coll = (req.collection or COLLECTION)
    try:
        await c.get_collection(coll)
    except Exception:
        return {"deleted": 0, "collection": coll}

    deleted = 0
    # delete by explicit video_ids
    if req.video_ids:
        flt = qm.Filter(
            must=[
                qm.FieldCondition(
                    key="video_id",
                    match=qm.MatchAny(any=req.video_ids),
                )
            ]
        )
        await c.delete(collection_name=coll, points_selector=qm.FilterSelector(filter=flt))
        # Qdrant delete is async; we cannot easily know exact count here
        return {"deleted": None, "collection": coll, "by": "video_ids", "count_unknown": True}

    # delete by prefix by scanning
    if req.video_id_prefix:
        next_page = None
        batch_ids: List[Any] = []
        while True:
            sc, next_page = await c.scroll(
                collection_name=coll,
                with_payload=True,
                limit=1024,
                offset=next_page,
            )
            for pt in sc:
                try:
                    p = pt.payload or {}
                    vid = str(p.get("video_id") or "")
                    if vid.startswith(req.video_id_prefix):
                        batch_ids.append(pt.id)
                        if len(batch_ids) >= 512:
                            await c.delete(collection_name=coll, points_selector=qm.PointIdsList(points=batch_ids))
                            deleted += len(batch_ids)
                            batch_ids = []
                except Exception:
                    continue
            if not next_page:
                break
        if batch_ids:
            await c.delete(collection_name=coll, points_selector=qm.PointIdsList(points=batch_ids))
            deleted += len(batch_ids)
        return {"deleted": deleted, "collection": coll, "by": "prefix"}

    return {"deleted": 0, "collection": coll}

# ---------------- Ingestion (SRT) ----------------

from fastapi import BackgroundTasks
import asyncio
import re

JOB: Dict[str, Any] = {"running": False, "total": 0, "upserted": 0, "errors": 0, "dir": None}


def _parse_srt_time(t: str) -> int:
    # HH:MM:SS,mmm
    hh, mm, rest = t.split(":", 2)
    ss, ms = rest.split(",", 1)
    return (int(hh) * 3600 + int(mm) * 60 + int(ss)) * 1000 + int(ms)


def _normalize_text(s: str) -> str:
    # Keep word chars (letters, digits, underscore) and whitespace; collapse spaces
    # Python re does not support \p{L}/\p{N}; using \w with UNICODE is sufficient for most languages
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = re.sub(r"\s+", " ", s, flags=re.UNICODE)
    return s.strip().lower()


async def _ingest_dir(dir_path: str):
    import os

    JOB.update({"running": True, "total": 0, "upserted": 0, "errors": 0, "dir": dir_path})
    points_batch: List[qm.PointStruct] = []
    texts_batch: List[str] = []
    entries_batch: List[Dict[str, Any]] = []

    # scan .srt files
    files = [f for f in os.listdir(dir_path) if f.endswith(".srt")]
    JOB["total"] = len(files)
    print(f"[vector-api] ingest start dir={dir_path} files={len(files)}")

    client = qdrant()
    await ensure_collection(client)

    for fname in files:
        try:
            path = os.path.join(dir_path, fname)
            base = os.path.splitext(os.path.basename(fname))[0]
            m = re.match(r"^(.*?)(?:_(\d+))?$", base)
            video_id = m.group(1) if m else base
            episode = int(m.group(2)) if (m and m.group(2)) else 1

            # read file
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            lines = [ln.strip() for ln in content.splitlines()]
            seq = None
            start = None
            end = None
            text_lines: List[str] = []

            def flush_block():
                nonlocal points_batch, texts_batch, entries_batch, seq, start, end, text_lines
                if seq is None or start is None or end is None:
                    return
                text = " ".join(text_lines).strip()
                if not text:
                    return
                norm = _normalize_text(text)
                entry_id = f"{video_id}_{episode}_{seq}"
                # stash to batch
                entries_batch.append(
                    {
                        "id": entry_id,
                        "payload": {
                            "video_id": video_id,
                            "episode": episode,
                            "sequence": seq,
                            "start_ms": start,
                            "end_ms": end,
                            "text": text,
                            "normalized_text": norm,
                        },
                    }
                )
                # Use raw text for embeddings to match query format and non-E5 models
                texts_batch.append(norm if norm else text)

            state = "seq"
            for ln in lines + [""]:
                if ln == "":
                    flush_block()
                    seq, start, end, text_lines = None, None, None, []
                    state = "seq"
                    continue
                if state == "seq":
                    if ln.isdigit():
                        seq = int(ln)
                        state = "time"
                    continue
                if state == "time":
                    mt = re.search(r"(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})", ln)
                    if mt:
                        start = _parse_srt_time(mt.group(1))
                        end = _parse_srt_time(mt.group(2))
                        state = "text"
                    continue
                if state == "text":
                    text_lines.append(ln)

            # embed + upsert per file in chunks
            if texts_batch:
                vectors = await tei_embed(texts_batch)
                for ent, vec in zip(entries_batch, vectors):
                    points_batch.append(
                        qm.PointStruct(id=_safe_point_id(ent["id"]), vector=vec, payload=ent["payload"])  # type: ignore
                    )
                await client.upsert(COLLECTION, points=points_batch)
                JOB["upserted"] += len(points_batch)
                print(f"[vector-api] upsert file={fname} points={len(points_batch)}")
                points_batch, texts_batch, entries_batch = [], [], []
        except Exception as e:
            JOB["errors"] += 1
            # Reset batches to avoid leaking across files
            points_batch, texts_batch, entries_batch = [], [], []
            print(f"[vector-api] ingest error file={fname}: {e}")
            continue

    JOB["running"] = False
    print(
        f"[vector-api] ingest done dir={dir_path} upserted={JOB['upserted']} errors={JOB['errors']}"
    )


class IngestRequest(BaseModel):
    dir: Optional[str] = None


@app.post("/ingest")
async def ingest(req: IngestRequest, bg: BackgroundTasks):
    dir_path = req.dir or os.getenv("SUBTITLES_DIR", "/data/subtitles")
    if JOB.get("running"):
        return {"accepted": False, "running": True, "dir": JOB.get("dir")}
    bg.add_task(_ingest_dir, dir_path)
    return {"accepted": True, "dir": dir_path}


@app.get("/ingest/status")
async def ingest_status():
    return JOB
