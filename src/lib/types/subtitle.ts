// 台词数据结构定义

export interface SubtitleEntry {
  id: string; // 唯一标识符
  videoId: string; // 视频ID (如: BV1JG4y1g76F)
  episodeNumber: number; // 集数（无下划线时默认为 1）
  sequenceNumber: number; // 在视频中的序号
  startTime: number; // 开始时间（毫秒）
  endTime: number; // 结束时间（毫秒）
  text: string; // 台词文本
  normalizedText: string; // 标准化后的文本（用于搜索）
  duration: number; // 持续时间（毫秒）
  // 可选：向量表示（如已预计算）
  embedding?: number[];
}

export interface VideoSubtitle {
  videoId: string;
  episodeNumber: number; // 集数（无下划线时默认为 1）
  entries: SubtitleEntry[];
}

// 搜索相关类型
export interface SearchOptions {
  query: string;
  videoIds?: string[]; // 限制搜索的视频范围
  limit?: number; // 结果数量限制
  offset?: number; // 分页偏移
}

export interface SearchResult {
  entry: SubtitleEntry;
  score: number; // 匹配分数
  source?: 'keyword' | 'vector'; // 结果来源
  confidence?: number; // 0..1 归一化置信度
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

// SRT 解析相关类型
export interface SRTBlock {
  sequence: number;
  startTime: string;
  endTime: string;
  text: string;
}
