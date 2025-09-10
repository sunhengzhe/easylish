import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';

import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';

const FIXTURE_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'subtitles');

describe('SubtitleSearchService - best match (vector mandatory)', () => {
  const service = SubtitleSearchService.getInstance();

  beforeAll(async () => {
    process.env.SUBTITLES_DIR = FIXTURE_DIR;
    // 强制向量检索，使用 hash 提供器以避免测试下载模型
    process.env.VECTOR_PROVIDER = 'hash';
    await service.reload(FIXTURE_DIR);
  });

  it('should find the best match for an English query', async () => {
    const best = await service.getBestMatch('good morning');
    expect(best).not.toBeNull();
    expect(best!.entry.videoId).toBe('TEST_EN_1');
    expect(best!.entry.startTime).toBe(4000); // 00:00:04,000
  });

  it('should handle Chinese queries with Unicode normalization', async () => {
    const best = await service.getBestMatch('天气不错');
    expect(best).not.toBeNull();
    expect(best!.entry.videoId).toBe('TEST_ZH_1');
    expect(best!.entry.startTime).toBe(8000); // 00:00:08,000
  });

  it('should return a result via vector search (hash provider in tests)', async () => {
    const best = await service.getBestMatch('hello world');
    expect(best).not.toBeNull();
    expect(best!.entry.videoId).toBe('TEST_EN_1');
  });
});

describe('SubtitleSearchService - ranking & pagination basics', () => {
  const service = SubtitleSearchService.getInstance();

  beforeAll(async () => {
    process.env.SUBTITLES_DIR = FIXTURE_DIR;
    process.env.VECTOR_PROVIDER = 'hash';
    await service.reload(FIXTURE_DIR);
  });

  it('should prioritize exact phrase matches', async () => {
    const { results } = await service.search({ query: 'hello world', limit: 5 });
    expect(results.length).toBeGreaterThan(0);
    // The first entry should be the line that contains the full phrase
    expect(results[0].entry.text.toLowerCase()).toContain('hello world');
  });
});
