import { describe, it, expect } from 'vitest';
import { SearchResult, SubtitleEntry } from '../apps/web/src/lib/types/subtitle';

/**
 * 对搜索结果按视频去重，保留每个视频中分数最高的一条记录
 */
function deduplicateByVideo(results: SearchResult[]): SearchResult[] {
  const videoMap = new Map<string, SearchResult>();
  
  for (const result of results) {
    const videoId = result.entry.videoId;
    const existingResult = videoMap.get(videoId);
    
    // 如果该视频还没有记录，或者当前结果分数更高，则更新
    if (!existingResult || result.score > existingResult.score) {
      videoMap.set(videoId, result);
    }
  }
  
  // 返回去重后的结果，按原始分数排序
  return Array.from(videoMap.values()).sort((a, b) => b.score - a.score);
}

// 辅助函数：创建测试用的 SubtitleEntry
function createSubtitleEntry(videoId: string, id: string, text: string): SubtitleEntry {
  return {
    id,
    videoId,
    episodeNumber: 1,
    sequenceNumber: 1,
    startTime: 0,
    endTime: 1000,
    text,
    normalizedText: text.toLowerCase(),
    duration: 1000,
  };
}

// 辅助函数：创建测试用的 SearchResult
function createSearchResult(videoId: string, score: number, text: string, id?: string): SearchResult {
  return {
    entry: createSubtitleEntry(videoId, id || `${videoId}-${score}`, text),
    score,
    source: 'vector',
  };
}

describe('Video Deduplication Logic', () => {
  it('should return empty array for empty input', () => {
    const result = deduplicateByVideo([]);
    expect(result).toEqual([]);
  });

  it('should return same array when all videos are unique', () => {
    const input = [
      createSearchResult('BV123', 0.9, 'First video'),
      createSearchResult('BV456', 0.8, 'Second video'),
      createSearchResult('BV789', 0.7, 'Third video'),
    ];

    const result = deduplicateByVideo(input);
    
    expect(result).toHaveLength(3);
    expect(result[0].entry.videoId).toBe('BV123');
    expect(result[0].score).toBe(0.9);
    expect(result[1].entry.videoId).toBe('BV456');
    expect(result[1].score).toBe(0.8);
    expect(result[2].entry.videoId).toBe('BV789');
    expect(result[2].score).toBe(0.7);
  });

  it('should keep highest score for duplicate videos', () => {
    const input = [
      createSearchResult('BV123', 0.7, 'Lower score', 'entry1'),
      createSearchResult('BV456', 0.8, 'Single video', 'entry2'),
      createSearchResult('BV123', 0.9, 'Higher score', 'entry3'), // 同一视频，更高分数
      createSearchResult('BV789', 0.6, 'Another video', 'entry4'),
      createSearchResult('BV456', 0.5, 'Lower score duplicate', 'entry5'), // 同一视频，更低分数
    ];

    const result = deduplicateByVideo(input);
    
    expect(result).toHaveLength(3);
    
    // 验证 BV123 保留了更高分数的记录
    const bv123Result = result.find(r => r.entry.videoId === 'BV123');
    expect(bv123Result).toBeDefined();
    expect(bv123Result!.score).toBe(0.9);
    expect(bv123Result!.entry.text).toBe('Higher score');
    expect(bv123Result!.entry.id).toBe('entry3');
    
    // 验证 BV456 保留了更高分数的记录
    const bv456Result = result.find(r => r.entry.videoId === 'BV456');
    expect(bv456Result).toBeDefined();
    expect(bv456Result!.score).toBe(0.8);
    expect(bv456Result!.entry.text).toBe('Single video');
    expect(bv456Result!.entry.id).toBe('entry2');
    
    // 验证 BV789 保留唯一记录
    const bv789Result = result.find(r => r.entry.videoId === 'BV789');
    expect(bv789Result).toBeDefined();
    expect(bv789Result!.score).toBe(0.6);
    expect(bv789Result!.entry.text).toBe('Another video');
  });

  it('should maintain correct sorting by score after deduplication', () => {
    const input = [
      createSearchResult('BV123', 0.5, 'Low score 1'),
      createSearchResult('BV456', 0.9, 'High score'),
      createSearchResult('BV123', 0.8, 'Medium score'), // 同一视频，更高分数
      createSearchResult('BV789', 0.7, 'Medium-low score'),
      createSearchResult('BV456', 0.3, 'Very low score'), // 同一视频，更低分数
    ];

    const result = deduplicateByVideo(input);
    
    expect(result).toHaveLength(3);
    
    // 验证结果按分数降序排列
    expect(result[0].score).toBe(0.9); // BV456
    expect(result[0].entry.videoId).toBe('BV456');
    
    expect(result[1].score).toBe(0.8); // BV123
    expect(result[1].entry.videoId).toBe('BV123');
    
    expect(result[2].score).toBe(0.7); // BV789
    expect(result[2].entry.videoId).toBe('BV789');
    
    // 验证分数递减
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
    }
  });

  it('should handle multiple duplicates of same video', () => {
    const input = [
      createSearchResult('BV123', 0.5, 'Score 5', 'entry1'),
      createSearchResult('BV123', 0.8, 'Score 8', 'entry2'),
      createSearchResult('BV123', 0.3, 'Score 3', 'entry3'),
      createSearchResult('BV123', 0.9, 'Score 9', 'entry4'), // 最高分
      createSearchResult('BV123', 0.7, 'Score 7', 'entry5'),
    ];

    const result = deduplicateByVideo(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].entry.videoId).toBe('BV123');
    expect(result[0].score).toBe(0.9);
    expect(result[0].entry.text).toBe('Score 9');
    expect(result[0].entry.id).toBe('entry4');
  });

  it('should handle edge case with equal scores', () => {
    const input = [
      createSearchResult('BV123', 0.8, 'First entry', 'entry1'),
      createSearchResult('BV456', 0.9, 'Different video', 'entry2'),
      createSearchResult('BV123', 0.8, 'Second entry with same score', 'entry3'), // 相同分数
    ];

    const result = deduplicateByVideo(input);
    
    expect(result).toHaveLength(2);
    
    // 当分数相同时，应该保留第一个遇到的（Map 的行为）
    const bv123Result = result.find(r => r.entry.videoId === 'BV123');
    expect(bv123Result).toBeDefined();
    expect(bv123Result!.score).toBe(0.8);
    expect(bv123Result!.entry.text).toBe('First entry');
    expect(bv123Result!.entry.id).toBe('entry1');
  });

  it('should preserve all SearchResult properties', () => {
    const input = [
      {
        entry: createSubtitleEntry('BV123', 'entry1', 'Test text'),
        score: 0.9,
        source: 'vector' as const,
        confidence: 0.85,
      },
      {
        entry: createSubtitleEntry('BV123', 'entry2', 'Another text'),
        score: 0.7,
        source: 'keyword' as const,
        confidence: 0.75,
      },
    ];

    const result = deduplicateByVideo(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(0.9);
    expect(result[0].source).toBe('vector');
    expect(result[0].confidence).toBe(0.85);
    expect(result[0].entry.text).toBe('Test text');
  });

  it('should handle single item correctly', () => {
    const input = [createSearchResult('BV123', 0.8, 'Single item')];
    const result = deduplicateByVideo(input);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(input[0]);
  });
});
