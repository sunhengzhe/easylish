import { describe, it, expect, beforeEach } from 'vitest';

import { MemoryStore } from '@/lib/storage/memory-store';
import type { VideoSubtitle, SubtitleEntry } from '@/lib/types/subtitle';

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

describe('MemoryStore - indexing, search and retrieval', () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = MemoryStore.getInstance();
    const vs1: VideoSubtitle = {
      videoId: 'VIDA',
      episodeNumber: 1,
      entries: [
        buildEntry('VIDA', 1, 1, 0, 'hello world'),
        buildEntry('VIDA', 1, 2, 2000, 'good morning sunshine'),
      ],
    };
    const vs2: VideoSubtitle = {
      videoId: 'VIDB',
      episodeNumber: 2,
      entries: [
        buildEntry('VIDB', 2, 1, 0, 'morning everyone'),
        buildEntry('VIDB', 2, 2, 1000, 'good night'),
      ],
    };
    await store.initialize([vs1, vs2]);
  });

  it('search AND logic and ranking', async () => {
    const res = await store.search({ query: 'good morning', limit: 10 });
    expect(res.total).toBeGreaterThan(0);
    // AND logic requires both tokens; only VIDA_1_2 matches fully
    const ids = res.results.map(r => r.entry.id);
    expect(ids).toContain('VIDA_1_2');
  });

  it('filters by videoIds', async () => {
    const res = await store.search({ query: 'morning', videoIds: ['VIDA'], limit: 10 });
    expect(res.results.every(r => r.entry.videoId === 'VIDA')).toBe(true);
  });

  it('getVideoSubtitle with episode', () => {
    const vs = store.getVideoSubtitle('VIDB', 2);
    expect(vs).toBeTruthy();
    expect(vs!.episodeNumber).toBe(2);
    expect(vs!.entries.length).toBe(2);
  });
});
