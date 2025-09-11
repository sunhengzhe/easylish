import { VideoSubtitle } from '@/lib/types/subtitle';
import * as Remote from '@/lib/vector/backend-remote';

export class VectorSearchService {
  private static instance: VectorSearchService;
  private initialized = false;

  private constructor() {}

  static getInstance(): VectorSearchService {
    if (!VectorSearchService.instance) {
      VectorSearchService.instance = new VectorSearchService();
    }
    return VectorSearchService.instance;
  }

  async initialize(videoSubtitles: VideoSubtitle[]): Promise<void> {
    if (this.initialized) return;
    // In remote mode, ingestion is handled asynchronously by vector-api.
    // We simply mark as initialized to allow queries.
    this.initialized = true;
  }

  async rebuild(videoSubtitles: VideoSubtitle[]): Promise<void> {
    this.initialized = false;
    await this.initialize(videoSubtitles);
  }

  async searchTopK(query: string, topK = 1): Promise<Array<{ entryId: string; score: number }>> {
    if (!this.initialized) return [];
    return await Remote.search(query.toLowerCase(), topK);
  }

  isReady(): boolean { return this.initialized; }
}
