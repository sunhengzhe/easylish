const BASE = process.env.TEI_URL || 'http://localhost:8080';
export const TEI_MAX_BATCH = Number(process.env.TEI_BATCH_SIZE || '32');

function toNumberArray(x: any): number[] | null {
  if (!Array.isArray(x)) return null;
  for (const v of x) {
    if (typeof v !== 'number') return null;
  }
  return x as number[];
}

function normalizeEmbeddings(data: any, expected: number): number[][] {
  // Common TEI shapes:
  // { embeddings: number[][] }
  // { data: number[][] }
  // { data: [{ embedding: number[]}, ...] }
  // { embedding: number[] } (single)
  // number[][] (bare)
  // [number[]] (single wrapped)

  // 1) top-level fields
  if (data && typeof data === 'object') {
    if (Array.isArray(data.embeddings)) return data.embeddings as number[][];
    if (Array.isArray(data.data)) {
      // Could be array of arrays or array of objects
      if (data.data.length > 0 && toNumberArray(data.data[0])) {
        return data.data as number[][];
      }
      const arr = data.data.map((d: any) => d?.embedding).filter(Boolean);
      if (arr.length) return arr as number[][];
    }
    if (toNumberArray(data.embedding)) return [data.embedding as number[]];
  }

  // 2) bare arrays
  if (Array.isArray(data)) {
    if (data.length && toNumberArray(data[0])) return data as number[][];
    const arr = data.map((d) => d?.embedding).filter(Boolean);
    if (arr.length) return arr as number[][];
  }

  // 3) if expected is 1 and we see a single vector-like array inside
  if (expected === 1 && toNumberArray(data)) return [data as number[]];

  throw new Error('Invalid TEI response');
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  // Ensure no empty items are sent to TEI
  const nonEmpty = texts.filter((t) => typeof t === 'string' && t.trim().length > 0);
  if (nonEmpty.length === 0) return [];
  const res = await fetch(`${BASE}/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputs: nonEmpty }),
    // TEI is local; adjust timeout outside if needed
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`TEI /embed failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return normalizeEmbeddings(data, nonEmpty.length);
}

export async function embedOne(text: string): Promise<number[]> {
  const out = await embedBatch([text]);
  return out[0] || [];
}

export async function embedBatchChunked(texts: string[], maxBatch = TEI_MAX_BATCH): Promise<number[][]> {
  if (!texts.length) return [];
  const result: number[][] = [];
  const size = Math.max(1, Math.min(maxBatch, TEI_MAX_BATCH));
  for (let i = 0; i < texts.length; i += size) {
    const chunk = texts.slice(i, i + size).filter((t) => typeof t === 'string' && t.trim().length > 0);
    if (chunk.length === 0) continue;
    const part = await embedBatch(chunk);
    result.push(...part);
  }
  return result;
}
