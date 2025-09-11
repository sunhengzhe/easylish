import { SearchOptions, SearchResponse, SubtitleEntry, VideoSubtitle, SearchResult } from '../types/subtitle';
import { VectorSearchService } from './vector-search-service';

/**
 * 字幕搜索服务
 * 统一管理字幕数据的加载、存储和搜索
 */
export class SubtitleSearchService {
  private static instance: SubtitleSearchService;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private vectorService: VectorSearchService | null = null;
  private useVector = true; // 向量检索为必选

  private constructor() {
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SubtitleSearchService {
    if (!SubtitleSearchService.instance) {
      SubtitleSearchService.instance = new SubtitleSearchService();
    }
    return SubtitleSearchService.instance;
  }

  /**
   * 初始化服务（加载所有字幕文件）
   */
  async initialize(subtitlesDir?: string): Promise<void> {
    // 防止重复初始化
    if (this.isInitialized) {
      console.log('🔄 Service already initialized, skipping...');
      return;
    }

    if (this.initializationPromise) {
      console.log('🔄 Initialization already in progress, waiting...');
      await this.initializationPromise;
      return;
    }

    console.log('🚀 Starting subtitle search service initialization...');
    this.initializationPromise = this.doInitialize(subtitlesDir);
    await this.initializationPromise;
  }

  private async doInitialize(subtitlesDir?: string): Promise<void> {
    const startTime = Date.now();
    try {
      // 向量检索（远程后端，异步 ingest 由 vector-api 完成）
      console.log('🧠 Initializing vector search index (remote)...');
      this.vectorService = VectorSearchService.getInstance();
      await this.vectorService.initialize([]);
      try {
        const auto = String(process.env.VECTOR_REMOTE_INGEST_AUTOSTART || '1') !== '0';
        if (auto) {
          const { ingest } = await import('../vector/backend-remote');
          const ing = await ingest(subtitlesDir || process.env.SUBTITLES_DIR);
          console.log('🧵 Vector ingest requested:', ing);
        }
      } catch (e) {
        console.warn('Vector ingest trigger failed (non-fatal):', (e as Error)?.message);
      }

      const vectorReady = this.vectorService.isReady();
      console.log('✅ Vector search ready:', vectorReady);

      this.isInitialized = true;

      const duration = Date.now() - startTime;
      console.log(`✅ Subtitle search service initialized successfully in ${duration}ms`);

      console.log(`📊 Service Stats: managed by vector-api`);

    } catch (error) {
      console.error('❌ Failed to initialize subtitle search service:', error);
      // 重置状态，允许重试
      this.isInitialized = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  // 本地 SRT/MemoryStore 已移除，元数据由 vector-api 管理

  /**
   * 搜索字幕
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    await this.ensureInitialized();
    // 统一走向量检索
    return this.searchVectorTopK(options.query, options.limit ?? 20);
  }

  /**
   * 根据ID获取字幕条目
   */
  async getEntryById(id: string): Promise<SubtitleEntry | undefined> {
    await this.ensureInitialized();
    return undefined; // 如需按ID获取，建议由 vector-api 提供专用接口
  }

  /**
   * 获取视频的所有字幕
   */
  async getVideoSubtitle(videoId: string, episodeNumber = 1): Promise<VideoSubtitle | undefined> {
    await this.ensureInitialized();
    return undefined; // 建议改由 vector-api 提供
  }

  /**
   * 获取服务统计信息
   */
  async getStats() {
    await this.ensureInitialized();
    try {
      const { vectorStatus } = await import('../vector/backend-remote');
      return await vectorStatus();
    } catch {
      return null;
    }
  }

  /**
   * 检查服务是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * 重新加载字幕数据（用于开发环境热更新）
   */
  async reload(subtitlesDir?: string): Promise<void> {
    console.log('🔄 Reloading subtitle search service...');
    this.isInitialized = false;
    this.initializationPromise = null;
    await this.initialize(subtitlesDir);
  }

  /**
   * 搜索建议（自动完成）
   */
  async getSuggestions(query: string, limit = 10): Promise<string[]> {
    await this.ensureInitialized();

    if (!query.trim()) {
      return [];
    }

    // 简单的建议实现：搜索匹配的文本片段
    const searchResult = await this.search({
      query: query.trim(),
      limit: limit * 2, // 多获取一些结果用于提取建议
    });

    const suggestions = new Set<string>();
    const queryWords = query.toLowerCase().trim().split(/\s+/);

    for (const result of searchResult.results) {
      const text = result.entry.text.toLowerCase();
      const words = text.split(/\s+/);

      // 查找包含查询词的短语
      for (let i = 0; i < words.length - queryWords.length + 1; i++) {
        const phrase = words.slice(i, i + queryWords.length + 2).join(' ');
        if (phrase.includes(query.toLowerCase())) {
          suggestions.add(phrase);
          if (suggestions.size >= limit) {
            break;
          }
        }
      }

      if (suggestions.size >= limit) {
        break;
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * 获取最优匹配（向量优先，回退关键词）
   */
  async getBestMatch(query: string): Promise<{ entry: SubtitleEntry; score: number } | null> {
    await this.ensureInitialized();

    // 尝试使用向量检索
    if (this.useVector && this.vectorService && this.vectorService.isReady()) {
      const top = await this.vectorService.searchTopK(query, 1);
      if (top.length > 0) {
        const byId = await this.getEntryById(top[0].entryId);
        if (byId) return { entry: byId, score: top[0].score };
      }
    }

    // 回退到关键词检索
    const keyword = await this.search({ query, limit: 1 });
    if (keyword.results.length > 0) return keyword.results[0];
    return null;
  }

  /**
   * 向量检索 Top-K（返回 SearchResponse 结构，包含归一化置信度）
   */
  async searchVectorTopK(query: string, limit = 10) {
    await this.ensureInitialized();

    if (!this.vectorService || !this.vectorService.isReady()) {
      // 回退到关键词检索
      return this.search({ query, limit });
    }

    const top = await this.vectorService.searchTopK(query, limit);
    if (process.env.NODE_ENV !== 'production') {
      const scores = Array.isArray(top) ? (top as any[]).map((t) => t?.score ?? 0) : [];
      const confs = scores.map((s) => Math.max(0, Math.min(1, s)));
      const max = scores.length ? Math.max(...scores) : null;
      const min = scores.length ? Math.min(...scores) : null;
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const cmax = confs.length ? Math.max(...confs) : null;
      const cmin = confs.length ? Math.min(...confs) : null;
      const cavg = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
      console.log('[web] vector search stats', { q: query, got: scores.length, min, max, avg, cmin, cmax, cavg });
    }
    const results: SearchResult[] = [];
    const qnorm = (query || '').toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').trim();
    for (const item of top as Array<any>) {
      let entry: SubtitleEntry | undefined;
      const p = item.payload;
      if (p && typeof p === 'object') {
        // Build entry from vector-api payload
        entry = {
          id: item.entryId,
          videoId: String(p.video_id ?? ''),
          episodeNumber: Number(p.episode ?? 1),
          sequenceNumber: Number(p.sequence ?? 0),
          startTime: Number(p.start_ms ?? 0),
          endTime: Number(p.end_ms ?? 0),
          text: String(p.text ?? ''),
          normalizedText: String(p.normalized_text ?? ''),
          duration: Math.max(0, Number(p.end_ms ?? 0) - Number(p.start_ms ?? 0)),
        };
      } else {
        // Fallback: use local store if available
        entry = await this.getEntryById(item.entryId);
      }
      if (entry) {
        const score = item.score; // Qdrant cosine similarity in [0, 1]
        // Heuristic calibration: penalize extremely short targets unless they contain the query
        const text = (entry.normalizedText || entry.text || '').toLowerCase();
        const clean = text.replace(/[^\p{L}\p{N}]+/gu, '');
        let penalty = 1.0;
        const contains = qnorm && (text.includes(qnorm) || (entry.text || '').toLowerCase().includes(qnorm));
        if (!contains) {
          if (clean.length <= 2) penalty *= 0.35; // single-word/very short like "hi", "ok", "bye"
          else if (clean.length <= 4) penalty *= 0.7;
        }
        const confidence = Math.max(0, Math.min(1, score * penalty));
        results.push({ entry, score, confidence, source: 'vector' });
      }
    }
    return {
      results,
      total: results.length,
      query,
    } as SearchResponse;
  }

  /**
   * 获取热门搜索词（基于字幕内容的词频分析）
   */
  async getPopularTerms(limit = 20): Promise<Array<{ term: string; frequency: number }>> {
    await this.ensureInitialized();
    // 本地 MemoryStore 已移除，热门词建议改由 vector-api 侧统计
    // 这里返回空数组占位，避免阻断构建
    return [];
  }
}
