import { SubtitleEntry } from '@/lib/types/subtitle';

export interface VectorIndex {
  upsert(entries: SubtitleEntry[], embedder: { embedBatch(texts: string[]): Promise<number[][]> }): Promise<void>;
  query(queryEmbedding: number[], topK: number): Array<{ entryId: string; score: number }>;
  size(): number;
}

export class InMemoryVectorIndex implements VectorIndex {
  private embeddings: Map<string, Float32Array> = new Map(); // entryId -> embedding

  async upsert(entries: SubtitleEntry[], embedder: { embedBatch(texts: string[]): Promise<number[][]> }): Promise<void> {
    if (entries.length === 0) return;
    const texts = entries.map(e => e.normalizedText || e.text || '');
    const vectors = await embedder.embedBatch(texts);
    for (let i = 0; i < entries.length; i++) {
      const id = entries[i].id;
      const v = vectors[i];
      this.embeddings.set(id, Float32Array.from(v));
    }
  }

  query(queryEmbedding: number[], topK: number): Array<{ entryId: string; score: number }> {
    const q = Float32Array.from(queryEmbedding);
    const results: Array<{ entryId: string; score: number }> = [];
    for (const [id, emb] of this.embeddings) {
      const score = this.cosine(q, emb);
      results.push({ entryId: id, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  size(): number { return this.embeddings.size; }

  private cosine(a: Float32Array, b: Float32Array): number {
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
    return dot / denom;
  }
}

