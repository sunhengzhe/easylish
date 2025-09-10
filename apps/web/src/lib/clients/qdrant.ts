import { QdrantClient } from '@qdrant/js-client-rest';

const URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION = process.env.QDRANT_COLLECTION || 'subtitles';
const VECTOR_DIM = Number(process.env.VECTOR_DIM || '384');
const DISTANCE = (process.env.QDRANT_DISTANCE || 'Cosine') as 'Cosine' | 'Euclid' | 'Dot';

let client: QdrantClient | null = null;

function getClient() {
  if (!client) client = new QdrantClient({ url: URL });
  return client;
}

export async function ensureCollection(): Promise<void> {
  const c = getClient();
  try {
    await c.getCollection(COLLECTION);
  } catch {
    await c.createCollection(COLLECTION, {
      vectors: { size: VECTOR_DIM, distance: DISTANCE },
    });
  }
}

export async function upsertPoints(points: Array<{ id: string; vector: number[]; payload?: Record<string, unknown> }>): Promise<void> {
  if (!points.length) return;
  const c = getClient();
  await ensureCollection();
  await c.upsert(COLLECTION, { points });
}

export async function search(vector: number[], topK: number) {
  const c = getClient();
  await ensureCollection();
  const res = await c.search(COLLECTION, {
    vector,
    limit: Math.max(1, Math.min(100, topK)),
    with_payload: false,
  });
  return res.map((p) => ({ entryId: String(p.id), score: Number(p.score ?? 0) }));
}

