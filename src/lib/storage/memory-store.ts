import { SubtitleEntry, VideoSubtitle, SearchOptions, SearchResult, SearchResponse } from '../types/subtitle';

/**
 * 内存存储管理器
 * 设计为可扩展，将来可以轻松迁移到数据库
 */
export class MemoryStore {
  private static instance: MemoryStore;

  // 主要存储结构
  private subtitleEntries: Map<string, SubtitleEntry> = new Map(); // id -> entry
  private videoSubtitles: Map<string, VideoSubtitle> = new Map(); // key: videoId_episode -> subtitle
  private videoEntries: Map<string, string[]> = new Map(); // key: videoId_episode -> entryIds[]

  // 搜索索引
  private textIndex: Map<string, Set<string>> = new Map(); // word -> entryIds
  private normalizedTextIndex: Map<string, Set<string>> = new Map(); // normalizedWord -> entryIds

  // 统计信息
  private stats = {
    totalEntries: 0,
    totalVideos: 0,
    indexedWords: 0,
    lastUpdated: new Date(),
  };

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  /**
   * 初始化存储（加载所有字幕数据）
   */
  async initialize(videoSubtitles: VideoSubtitle[]): Promise<void> {
    console.log('Initializing memory store...');
    const startTime = Date.now();

    // 清空现有数据
    this.clear();

    // 加载数据
    for (const videoSubtitle of videoSubtitles) {
      await this.addVideoSubtitle(videoSubtitle);
    }

    // 更新统计信息
    this.stats.lastUpdated = new Date();

    const duration = Date.now() - startTime;
    console.log(`Memory store initialized in ${duration}ms:`);
    console.log(`- ${this.stats.totalVideos} videos`);
    console.log(`- ${this.stats.totalEntries} subtitle entries`);
    console.log(`- ${this.stats.indexedWords} indexed words`);
  }

  /**
   * 添加视频字幕数据
   */
  private async addVideoSubtitle(videoSubtitle: VideoSubtitle): Promise<void> {
    // 存储视频信息（包含集数）
    const compositeId = `${videoSubtitle.videoId}_${videoSubtitle.episodeNumber}`;
    this.videoSubtitles.set(compositeId, videoSubtitle);

    // 存储字幕条目
    const entryIds: string[] = [];

    for (const entry of videoSubtitle.entries) {
      this.subtitleEntries.set(entry.id, entry);
      entryIds.push(entry.id);

      // 建立文本索引
      this.indexText(entry.text, entry.id);
      this.indexText(entry.normalizedText, entry.id, true);
    }

    this.videoEntries.set(compositeId, entryIds);
    this.stats.totalVideos++;
    this.stats.totalEntries += videoSubtitle.entries.length;
  }

  /**
   * 建立文本索引
   */
  private indexText(text: string, entryId: string, isNormalized = false): void {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const index = isNormalized ? this.normalizedTextIndex : this.textIndex;

    for (const word of words) {
      const cleanWord = word.toLowerCase().trim();
      if (cleanWord.length > 0) {
        if (!index.has(cleanWord)) {
          index.set(cleanWord, new Set());
          if (isNormalized) this.stats.indexedWords++;
        }
        index.get(cleanWord)!.add(entryId);
      }
    }
  }

  /**
   * 搜索字幕
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    const { query, videoIds, limit = 50, offset = 0 } = options;

    if (!query.trim()) {
      return {
        results: [],
        total: 0,
        query,
      };
    }

    // 搜索匹配的条目ID
    const matchingEntryIds = this.findMatchingEntries(query, videoIds);

    // 对所有匹配项计算分数并排序，然后再分页
    const allResults: SearchResult[] = [];
    for (const entryId of matchingEntryIds) {
      const entry = this.subtitleEntries.get(entryId);
      if (!entry) continue;
      const score = this.calculateRelevanceScore(entry, query);
      allResults.push({ entry, score });
    }

    allResults.sort((a, b) => b.score - a.score);
    const results = allResults.slice(offset, offset + limit);

    return {
      results,
      total: allResults.length,
      query,
    };
  }

  /**
   * 查找匹配的条目
   */
  private findMatchingEntries(
    query: string,
    videoIds?: string[]
  ): Set<string> {
    const queryWords = query.toLowerCase().trim().split(/\s+/);
    const matchingEntryIds = new Set<string>();

    // 对每个查询词进行搜索
    for (const word of queryWords) {
      const wordMatches = this.findWordMatches(word);

      // 第一个词的结果作为基础
      if (matchingEntryIds.size === 0) {
        wordMatches.forEach(id => matchingEntryIds.add(id));
      } else {
        // 后续词需要与之前的结果求交集（AND逻辑）
        const intersection = new Set<string>();
        for (const id of matchingEntryIds) {
          if (wordMatches.has(id)) {
            intersection.add(id);
          }
        }
        matchingEntryIds.clear();
        intersection.forEach(id => matchingEntryIds.add(id));
      }
    }

    // 按视频ID过滤
    if (videoIds && videoIds.length > 0) {
      const filteredIds = new Set<string>();
      for (const entryId of matchingEntryIds) {
        const entry = this.subtitleEntries.get(entryId);
        if (entry && videoIds.includes(entry.videoId)) {
          filteredIds.add(entryId);
        }
      }
      return filteredIds;
    }

    return matchingEntryIds;
  }

  /**
   * 查找单词匹配
   */
  private findWordMatches(word: string): Set<string> {
    const matches = new Set<string>();
    const searchWord = word.toLowerCase();

    // 精确匹配
    const exactMatches = this.normalizedTextIndex.get(searchWord);
    if (exactMatches) {
      exactMatches.forEach(id => matches.add(id));
    }

    // 包含匹配
    for (const [indexedWord, entryIds] of this.normalizedTextIndex) {
      if (indexedWord.includes(searchWord) || searchWord.includes(indexedWord)) {
        entryIds.forEach(id => matches.add(id));
      }
    }

    return matches;
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevanceScore(entry: SubtitleEntry, query: string): number {
    const text = entry.text.toLowerCase();
    const searchQuery = query.toLowerCase();

    let score = 0;

    // 精确匹配得分最高
    if (text.includes(searchQuery)) {
      score += 100;
    }

    // 单词匹配得分
    const queryWords = searchQuery.split(/\s+/);
    for (const word of queryWords) {
      if (text.includes(word)) {
        score += 10;
      }
    }

    // 长度惩罚（较短的文本相关性更高）
    score -= Math.log(text.length + 1);

    return Math.max(0, score);
  }


  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 根据ID获取字幕条目
   */
  getEntryById(id: string): SubtitleEntry | undefined {
    return this.subtitleEntries.get(id);
  }

  /**
   * 获取视频的所有字幕
   */
  getVideoSubtitle(videoId: string, episodeNumber = 1): VideoSubtitle | undefined {
    const compositeId = `${videoId}_${episodeNumber}`;
    return this.videoSubtitles.get(compositeId);
  }

  /**
   * 清空所有数据
   */
  private clear(): void {
    this.subtitleEntries.clear();
    this.videoSubtitles.clear();
    this.videoEntries.clear();
    this.textIndex.clear();
    this.normalizedTextIndex.clear();

    this.stats = {
      totalEntries: 0,
      totalVideos: 0,
      indexedWords: 0,
      lastUpdated: new Date(),
    };
  }
}
