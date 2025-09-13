import { describe, it, expect } from 'vitest';
import { SearchResult, SubtitleEntry } from '../apps/web/src/lib/types/subtitle';

/**
 * 过滤掉 normalizedText 中只有单个词的搜索结果
 */
function filterSingleWords(results: SearchResult[]): SearchResult[] {
  return results.filter(result => {
    const normalizedText = result.entry.normalizedText || '';

    // 移除标点符号和多余空格，然后按空格分割
    const words = normalizedText
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留字母、数字、空格和中文字符
      .replace(/\s+/g, ' ') // 将多个空格合并为一个
      .trim()
      .split(' ')
      .filter(word => word.length > 0); // 移除空字符串

    // 只保留有多个词的结果
    return words.length > 1;
  });
}

// 辅助函数：创建测试用的 SubtitleEntry
function createSubtitleEntry(videoId: string, id: string, text: string, normalizedText?: string): SubtitleEntry {
  return {
    id,
    videoId,
    episodeNumber: 1,
    sequenceNumber: 1,
    startTime: 0,
    endTime: 1000,
    text,
    normalizedText: normalizedText || text.toLowerCase(),
    duration: 1000,
  };
}

// 辅助函数：创建测试用的 SearchResult
function createSearchResult(videoId: string, id: string, text: string, normalizedText?: string, score = 0.8): SearchResult {
  return {
    entry: createSubtitleEntry(videoId, id, text, normalizedText),
    score,
    source: 'vector' as const,
  };
}

describe('filterSingleWords', () => {
  it('should filter out results with single word in normalizedText', () => {
    const input: SearchResult[] = [
      createSearchResult('video1', '1', 'Hello world', 'hello world'), // 保留：两个词
      createSearchResult('video2', '2', 'Hi', 'hi'), // 过滤：单个词
      createSearchResult('video3', '3', 'Good morning', 'good morning'), // 保留：两个词
      createSearchResult('video4', '4', 'Yes', 'yes'), // 过滤：单个词
    ];

    const result = filterSingleWords(input);

    expect(result).toHaveLength(2);
    expect(result[0].entry.id).toBe('1');
    expect(result[1].entry.id).toBe('3');
  });

  it('should handle punctuation and extra spaces correctly', () => {
    const input: SearchResult[] = [
      createSearchResult('video1', '1', 'Hello, world!', 'hello, world!'), // 保留：两个词
      createSearchResult('video2', '2', 'Hi!', 'hi!'), // 过滤：单个词
      createSearchResult('video3', '3', 'Good   morning', 'good   morning'), // 保留：两个词（多个空格）
      createSearchResult('video4', '4', 'Yes...', 'yes...'), // 过滤：单个词
      createSearchResult('video5', '5', 'Well, okay', 'well, okay'), // 保留：两个词
    ];

    const result = filterSingleWords(input);

    expect(result).toHaveLength(3);
    expect(result[0].entry.id).toBe('1');
    expect(result[1].entry.id).toBe('3');
    expect(result[2].entry.id).toBe('5');
  });

  it('should handle Chinese text correctly', () => {
    const input: SearchResult[] = [
      createSearchResult('video1', '1', '你好世界', '你好 世界'), // 保留：两个词
      createSearchResult('video2', '2', '好的', '好的'), // 过滤：单个词
      createSearchResult('video3', '3', '早上好', '早上 好'), // 保留：两个词
      createSearchResult('video4', '4', '是', '是'), // 过滤：单个词
      createSearchResult('video5', '5', '很好很强大', '很好 很强大'), // 保留：两个词
    ];

    const result = filterSingleWords(input);

    expect(result).toHaveLength(3);
    expect(result[0].entry.id).toBe('1');
    expect(result[1].entry.id).toBe('3');
    expect(result[2].entry.id).toBe('5');
  });

  it('should handle mixed Chinese and English text', () => {
    const input: SearchResult[] = [
      createSearchResult('video1', '1', '你好 world', '你好 world'), // 保留：两个词
      createSearchResult('video2', '2', 'Hello 世界', 'hello 世界'), // 保留：两个词
      createSearchResult('video3', '3', 'OK', 'ok'), // 过滤：单个词
      createSearchResult('video4', '4', '好的 yes', '好的 yes'), // 保留：两个词
    ];

    const result = filterSingleWords(input);

    expect(result).toHaveLength(3);
    expect(result[0].entry.id).toBe('1');
    expect(result[1].entry.id).toBe('2');
    expect(result[2].entry.id).toBe('4');
  });

  it('should handle empty or undefined normalizedText', () => {
    // 手动创建测试数据，确保 normalizedText 真的是空或 undefined
    const input: SearchResult[] = [
      {
        entry: {
          id: '1',
          videoId: 'video1',
          episodeNumber: 1,
          sequenceNumber: 1,
          startTime: 0,
          endTime: 1000,
          text: 'Hello world',
          normalizedText: '', // 真正的空字符串
          duration: 1000,
        },
        score: 0.8,
        source: 'vector' as const,
      },
      {
        entry: {
          id: '2',
          videoId: 'video2',
          episodeNumber: 1,
          sequenceNumber: 1,
          startTime: 0,
          endTime: 1000,
          text: 'Good morning',
          normalizedText: undefined as any, // 真正的 undefined
          duration: 1000,
        },
        score: 0.8,
        source: 'vector' as const,
      },
      createSearchResult('video3', '3', 'Nice day', 'nice day'), // 保留：两个词
    ];

    const result = filterSingleWords(input);

    expect(result).toHaveLength(1);
    expect(result[0].entry.id).toBe('3');
  });

  it('should return empty array when input is empty', () => {
    const result = filterSingleWords([]);
    expect(result).toHaveLength(0);
  });

  it('should handle special characters and numbers', () => {
    const input: SearchResult[] = [
      createSearchResult('video1', '1', 'Test 123', 'test 123'), // 保留：两个词
      createSearchResult('video2', '2', '123', '123'), // 过滤：单个词（数字）
      createSearchResult('video3', '3', 'Good-morning', 'good morning'), // 保留：两个词
      createSearchResult('video4', '4', '@username', 'username'), // 过滤：单个词
      createSearchResult('video5', '5', 'Hello @world', 'hello world'), // 保留：两个词
    ];

    const result = filterSingleWords(input);

    expect(result).toHaveLength(3);
    expect(result[0].entry.id).toBe('1');
    expect(result[1].entry.id).toBe('3');
    expect(result[2].entry.id).toBe('5');
  });
});
