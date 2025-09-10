import { VideoSubtitle, SubtitleEntry } from '@/lib/types/subtitle';
import { EmbeddingsProvider, HashEmbeddingsProvider } from '@/lib/vector/embeddings';
import { InMemoryVectorIndex, VectorIndex } from '@/lib/vector/index';
import { embedBatchChunked, embedOne } from '@/lib/clients/tei';
import { ensureCollection, search as qdrantSearch, upsertPoints } from '@/lib/clients/qdrant';

export class VectorSearchService {
  private static instance: VectorSearchService;
  private index: VectorIndex;
  private embedder: EmbeddingsProvider;
  private initialized = false;

  private constructor(embedder?: EmbeddingsProvider, index?: VectorIndex) {
    const backend = (process.env.VECTOR_BACKEND || 'memory').toLowerCase();
    const dim = Number(process.env.VECTOR_DIM || '256');
    if (backend === 'direct') {
      this.embedder = embedder ?? new HashEmbeddingsProvider(dim); // unused in direct
      // index unused in direct; keep a tiny in-memory for interface but won't be used
      this.index = index ?? new InMemoryVectorIndex();
    } else {
      this.embedder = embedder ?? new HashEmbeddingsProvider(dim);
      this.index = index ?? new InMemoryVectorIndex();
    }
  }

  static getInstance(embedder?: EmbeddingsProvider, index?: VectorIndex): VectorSearchService {
    if (!VectorSearchService.instance) {
      VectorSearchService.instance = new VectorSearchService(embedder, index);
    }
    return VectorSearchService.instance;
  }

  async initialize(videoSubtitles: VideoSubtitle[]): Promise<void> {
    if (this.initialized) return;
    // Flatten entries
    const allEntries: SubtitleEntry[] = [];
    for (const vs of videoSubtitles) {
      for (const e of vs.entries) allEntries.push(e);
    }
    const backend = (process.env.VECTOR_BACKEND || 'memory').toLowerCase();
    if (backend === 'direct') {
      await ensureCollection();
      // Batch upsert to Qdrant; TEI micro-batches handled inside embedBatchChunked
      const UPSERT_BATCH = Number(process.env.QDRANT_UPSERT_BATCH_SIZE || '256');
      for (let i = 0; i < allEntries.length; i += UPSERT_BATCH) {
        const chunk = allEntries.slice(i, i + UPSERT_BATCH);
        // Filter out empty texts to avoid TEI validation errors
        const texts: string[] = [];
        const ids: string[] = [];
        const payloads: Array<{ video_id: string; episode: number }> = [];
        for (const e of chunk) {
          const tRaw = (e.normalizedText || e.text || '').trim();
          const t = tRaw ? `passage: ${tRaw}` : '';
          if (t.length === 0) continue;
          texts.push(t);
          ids.push(e.id);
          payloads.push({ video_id: e.videoId, episode: e.episodeNumber });
        }
        if (texts.length === 0) continue;
        try {
          const vectors = await embedBatchChunked(texts);
          const points = ids.map((id, j) => ({
            id,
            vector: vectors[j] || [],
            payload: payloads[j],
          }));
          if (points.length > 0) await upsertPoints(points);
        } catch (e) {
          console.warn('TEI embed batch failed, skipping chunk:', (e as Error)?.message);
        }
      }
    } else {
      await this.index.upsert(allEntries, this.embedder);
    }
    this.initialized = true;
  }

  async rebuild(videoSubtitles: VideoSubtitle[], embedder: EmbeddingsProvider): Promise<void> {
    this.embedder = embedder;
    this.index = new InMemoryVectorIndex();
    this.initialized = false;
    await this.initialize(videoSubtitles);
  }

  async searchTopK(query: string, topK = 1): Promise<Array<{ entryId: string; score: number }>> {
    if (!this.initialized) return [];
    const backend = (process.env.VECTOR_BACKEND || 'memory').toLowerCase();
    if (backend === 'direct') {
      const qvec = await embedOne(`query: ${query.toLowerCase()}`);
      return await qdrantSearch(qvec, topK);
    } else {
      const qvec = await this.embedder.embed(query.toLowerCase());
      return this.index.query(qvec, topK);
    }
  }

  isReady(): boolean {
    const backend = (process.env.VECTOR_BACKEND || 'memory').toLowerCase();
    if (backend === 'direct') return this.initialized;
    return this.initialized && this.index.size() > 0;
  }
}
