export function getTeiUrl(): string {
  return process.env.TEI_URL || 'http://localhost:8080';
}

export async function isTeiAvailable(base = getTeiUrl()): Promise<boolean> {
  try {
    const r = await fetch(`${base}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

type EmbLike = number[] | { embedding: number[] };

function normalizeEmbeddings(data: any): number[][] {
  // Accept several shapes: number[][] | {embeddings:number[][]} | {data:number[][]|{embedding:number[]}[]} | {embedding:number[]}
  if (Array.isArray(data)) {
    if (data.length && Array.isArray(data[0])) return data as number[][];
    if (data.length && typeof data[0] === 'object') return (data as EmbLike[]).map((d: any) => d.embedding);
  } else if (data && typeof data === 'object') {
    if (Array.isArray((data as any).embeddings)) return (data as any).embeddings as number[][];
    if (Array.isArray((data as any).data)) {
      const arr = (data as any).data;
      if (arr.length && Array.isArray(arr[0])) return arr as number[][];
      if (arr.length && Array.isArray(arr[0].embedding)) return arr.map((d: any) => d.embedding);
    }
    if (Array.isArray((data as any).embedding)) return [((data as any).embedding as number[])];
  }
  throw new Error('Invalid TEI response shape');
}

export async function embed(inputs: string[], base = getTeiUrl()): Promise<number[][]> {
  const res = await fetch(`${base}/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) throw new Error(`TEI error: ${res.status}`);
  const data = await res.json();
  return normalizeEmbeddings(data);
}

export async function embedWithType(
  inputs: string[],
  inputType: 'query' | 'passage',
  base = getTeiUrl(),
): Promise<number[][]> {
  // Prefer TEI's explicit input_type when supported; fallback to prefixing
  try {
    const res = await fetch(`${base}/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputs, input_type: inputType }),
    });
    if (res.ok) {
      const data = await res.json();
      return normalizeEmbeddings(data);
    }
  } catch {
    // ignore and fallback
  }
  const prefix = inputType === 'query' ? 'query: ' : 'passage: ';
  return embed(inputs.map((t) => `${prefix}${t}`), base);
}

export async function embedQuery(texts: string[], base = getTeiUrl()): Promise<number[][]> {
  return embedWithType(texts, 'query', base);
}

export async function embedPassage(texts: string[], base = getTeiUrl()): Promise<number[][]> {
  return embedWithType(texts, 'passage', base);
}
