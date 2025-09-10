import path from 'path';
import { SRTParser } from '../parsers/srt-parser';
import { MemoryStore } from '../storage/memory-store';
import { SearchOptions, SearchResponse, SubtitleEntry, VideoSubtitle } from '../types/subtitle';
import { VectorSearchService } from './vector-search-service';

/**
 * 字幕搜索服务
 * 统一管理字幕数据的加载、存储和搜索
 */
export class SubtitleSearchService {
  private static instance: SubtitleSearchService;
  private memoryStore: MemoryStore;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private vectorService: VectorSearchService | null = null;
  private useVector = false;

  private constructor() {
    this.memoryStore = MemoryStore.getInstance();
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
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize(subtitlesDir);
    await this.initializationPromise;
  }

  private async doInitialize(subtitlesDir?: string): Promise<void> {
    try {
      console.log('🚀 Starting subtitle search service initialization...');

      // 默认字幕目录，支持通过环境变量覆盖
      const defaultSubtitlesDir = path.join(process.cwd(), 'data', 'subtitles');
      const envDir = process.env.SUBTITLES_DIR;
      const targetDir = subtitlesDir || envDir || defaultSubtitlesDir;

      console.log(`📁 Loading subtitles from: ${targetDir}`);

      // 解析所有 SRT 文件
      const videoSubtitles = await SRTParser.parseAllSRTFiles(targetDir);

      if (videoSubtitles.length === 0) {
        console.warn('⚠️  No subtitle files found');
        this.isInitialized = true;
        return;
      }

      // 初始化内存存储
      await this.memoryStore.initialize(videoSubtitles);

      // 向量检索（可选）
      this.useVector = String(process.env.VECTOR_SEARCH_ENABLED).toLowerCase() === 'true';
      if (this.useVector) {
        console.log('🧠 Initializing vector search index...');
        this.vectorService = VectorSearchService.getInstance();
        await this.vectorService.initialize(videoSubtitles);
        console.log('✅ Vector search ready:', this.vectorService.isReady());
      }

      this.isInitialized = true;
      console.log('✅ Subtitle search service initialized successfully');

      // 打印统计信息
      const stats = this.memoryStore.getStats();
      console.log(`📊 Service Stats:`, stats);

    } catch (error) {
      console.error('❌ Failed to initialize subtitle search service:', error);
      throw error;
    }
  }

  /**
   * 搜索字幕
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    await this.ensureInitialized();
    return this.memoryStore.search(options);
  }

  /**
   * 根据ID获取字幕条目
   */
  async getEntryById(id: string): Promise<SubtitleEntry | undefined> {
    await this.ensureInitialized();
    return this.memoryStore.getEntryById(id);
  }

  /**
   * 获取视频的所有字幕
   */
  async getVideoSubtitle(videoId: string): Promise<VideoSubtitle | undefined> {
    await this.ensureInitialized();
    return this.memoryStore.getVideoSubtitle(videoId);
  }

  /**
   * 获取服务统计信息
   */
  async getStats() {
    await this.ensureInitialized();
    return this.memoryStore.getStats();
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
   * 获取热门搜索词（基于字幕内容的词频分析）
   */
  async getPopularTerms(limit = 20): Promise<Array<{ term: string; frequency: number }>> {
    await this.ensureInitialized();

    const stats = this.memoryStore.getStats();
    console.log(`Analyzing ${stats.totalEntries} entries for popular terms...`);

    // 这里可以实现更复杂的词频分析
    // 目前返回一个示例结果
    return [
      { term: 'love', frequency: 100 },
      { term: 'hello', frequency: 85 },
      { term: 'good morning', frequency: 70 },
      { term: 'thank you', frequency: 65 },
      { term: 'how are you', frequency: 60 },
    ].slice(0, limit);
  }
}
