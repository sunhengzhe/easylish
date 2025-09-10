import { VideoSubtitle, SubtitleEntry } from '@/lib/types/subtitle';
import { EmbeddingsProvider, HashEmbeddingsProvider } from '@/lib/vector/embeddings';
import { InMemoryVectorIndex, VectorIndex } from '@/lib/vector/index';

export class VectorSearchService {
  private static instance: VectorSearchService;
  private index: VectorIndex;
  private embedder: EmbeddingsProvider;
  private initialized = false;

  private constructor(embedder?: EmbeddingsProvider, index?: VectorIndex) {
    const dim = Number(process.env.VECTOR_DIM || '256');
    this.embedder = embedder ?? new HashEmbeddingsProvider(dim);
    this.index = index ?? new InMemoryVectorIndex();
  }

  static getInstance(embedder?: EmbeddingsProvider, index?: VectorIndex): VectorSearchService {
    if (!VectorSearchService.instance) {
      VectorSearchService.instance = new VectorSearchService(embedder, index);
    }
    return VectorSearchService.instance;
  }

  async initialize(videoSubtitles: VideoSubtitle[]): Promise<void> {
    if (this.initialized) return;
    // Flatten entries and build index
    const allEntries: SubtitleEntry[] = [];
    for (const vs of videoSubtitles) {
      for (const e of vs.entries) allEntries.push(e);
    }
    await this.index.upsert(allEntries, this.embedder);
    this.initialized = true;
  }

  async searchTopK(query: string, topK = 1): Promise<Array<{ entryId: string; score: number }>> {
    if (!this.initialized) return [];
    const qvec = await this.embedder.embed(query.toLowerCase());
    return this.index.query(qvec, topK);
  }

  isReady(): boolean { return this.initialized && this.index.size() > 0; }
}

