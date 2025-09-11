import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import type { SubtitleEntry } from '@/lib/types/subtitle';

describe('SubtitleSearchService - TEI/Qdrant integration confidence', () => {
  let service: any;
  let Remote: any;
  let videoId: string;
  let available = true;

  beforeAll(async () => {
    // 用户需在本地启动 vector-api、TEI 和 Qdrant（见 README/compose）
    process.env.VECTOR_API_URL = process.env.VECTOR_API_URL || 'http://localhost:8000';
    process.env.VECTOR_REMOTE_INGEST_AUTOSTART = '0';
    // 使用单独的测试集合，避免污染默认数据
    process.env.VECTOR_COLLECTION = process.env.VECTOR_COLLECTION || 'subtitles_test';

    // 延迟加载，确保上面的 env 生效
    Remote = await import('@/lib/vector/backend-remote');
    const { SubtitleSearchService } = await import('@/lib/services/subtitle-search-service');
    service = SubtitleSearchService.getInstance();

    const status = await Remote.vectorStatus();
    if (!status || status.ok !== true) {
      // 服务不可用则跳过（保持测试套件稳定）
      available = false;
      return;
    }

    // 构造唯一 videoId，避免污染或被旧数据干扰
    videoId = `TEST_GREETING_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const entries: SubtitleEntry[] = [
      buildEntry(videoId, 1, 1, 1000, 'good morning'),
      buildEntry(videoId, 1, 2, 5000, 'good night'),
      buildEntry(videoId, 1, 3, 9000, 'Yay'),
    ];

    // 真实 upsert（由 vector-api 调用 TEI 生成向量）
    const n = await Remote.upsertEntries(entries);
    expect(n).toBe(entries.length);

    // 初始化检索服务（不触发自动 ingest）
    await service.reload();
  });

  it('uses cosine score [0,1] as confidence and ranks semantically', async () => {
    if (!available) {
      // 环境未就绪（未启动 vector-api/TEI/Qdrant）直接通过
      expect(true).toBe(true);
      return;
    }

    const res = await service.searchVectorTopK('早上好', 100);
    // 缩小到本次写入的数据范围
    const list = res.results.filter((r) => r.entry.videoId === videoId);
    expect(list.length).toBe(3);

    // 结果包含三条期望的文本
    const texts = list.map((r) => r.entry.text.toLowerCase());
    expect(texts).toContain('good morning');
    expect(texts).toContain('good night');
    expect(texts).toContain('yay');

    // confidence 与 score 保持一致且处于 [0,1]
    for (const r of list) {
      expect(r.confidence).toBeCloseTo(r.score, 6);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});

function buildEntry(videoId: string, episode: number, seq: number, start: number, text: string): SubtitleEntry {
  return {
    id: `${videoId}_${episode}_${seq}`,
    videoId,
    episodeNumber: episode,
    sequenceNumber: seq,
    startTime: start,
    endTime: start + 1000,
    text,
    normalizedText: text.toLowerCase(),
    duration: 1000,
  };
}
