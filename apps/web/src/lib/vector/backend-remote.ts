import type { SubtitleEntry } from '@/lib/types/subtitle';

const BASE = process.env.VECTOR_API_URL || 'http://localhost:8000';
const COLLECTION = process.env.VECTOR_COLLECTION;
const UPSERT_FORMAT = process.env.VECTOR_UPSERT_FORMAT || 'raw'; // 'raw' | 'e5'
const QUERY_FORMAT = process.env.VECTOR_QUERY_FORMAT || 'raw';   // 'raw' | 'e5'

export async function upsertEntries(entries: SubtitleEntry[]): Promise<number> {
  // Only send non-empty texts; server will also validate
  const payload = {
    entries: entries
      .filter((e) => (e.normalizedText || e.text || '').trim().length > 0)
      .map((e) => ({
        id: e.id,
        text: e.normalizedText || e.text || '',
        video_id: e.videoId,
        episode: e.episodeNumber,
      })),
    format: UPSERT_FORMAT,
    collection: COLLECTION,
  };
  if (!payload.entries.length) return 0;
  const res = await fetch(`${BASE}/upsert`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`vector-api upsert failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return Number(data?.upserted || 0);
}

export async function search(query: string, topK: number): Promise<Array<{ entryId: string; score: number }>> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK, format: QUERY_FORMAT, collection: COLLECTION }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`vector-api query failed: ${res.status} ${t}`);
  }
  const data = (await res.json()) as Array<{ entryId: string; score: number }>;
  if (process.env.NODE_ENV !== 'production') {
    const scores = Array.isArray(data) ? data.map((d) => d?.score ?? 0) : [];
    const max = scores.length ? Math.max(...scores) : null;
    const min = scores.length ? Math.min(...scores) : null;
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    console.log('[web] vector-api search', { topK, got: scores.length, min, max, avg });
  }
  return data;
}

export async function ingest(dir?: string) {
  const res = await fetch(`${BASE}/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dir }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`vector-api ingest failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  console.log('[web] vector-api ingest', data);
  return data;
}

export async function ingestStatus() {
  const res = await fetch(`${BASE}/ingest/status`);
  if (!res.ok) return null;
  const data = await res.json();
  if (process.env.NODE_ENV !== 'production') console.log('[web] vector-api ingest/status', data);
  return data;
}

export async function vectorStatus() {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) return null;
  return await res.json();
}

export async function deleteByVideoIdPrefix(prefix: string) {
  const res = await fetch(`${BASE}/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ video_id_prefix: prefix, collection: COLLECTION }),
  });
  if (!res.ok) return null;
  return await res.json();
}
