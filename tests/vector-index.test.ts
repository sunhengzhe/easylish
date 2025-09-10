import { describe, it, expect } from 'vitest';
import { InMemoryVectorIndex } from '@/lib/vector';
import { HashEmbeddingsProvider } from '@/lib/vector/embeddings';
import type { SubtitleEntry, VideoSubtitle } from '@/lib/types/subtitle';

function entry(id: string, videoId: string, episode: number, text: string): SubtitleEntry {
  return {
    id,
    videoId,
    episodeNumber: episode,
    sequenceNumber: 1,
    startTime: 0,
    endTime: 1000,
    text,
    normalizedText: text.toLowerCase(),
    duration: 1000,
  };
}

describe('InMemoryVectorIndex + HashEmbeddingsProvider', () => {
  it('returns nearest neighbor by cosine similarity', async () => {
    const idx = new InMemoryVectorIndex();
    const embedder = new HashEmbeddingsProvider(128);
    const entries: SubtitleEntry[] = [
      entry('A_1_1', 'A', 1, 'hello world'),
      entry('B_1_1', 'B', 1, 'good morning'),
      entry('C_1_1', 'C', 1, 'good night'),
    ];
    await idx.upsert(entries, embedder);
    const q = await embedder.embed('morning');
    const res = idx.query(q, 2);
    expect(res.length).toBe(2);
    // Expect 'good morning' to rank first
    expect(res[0].entryId).toBe('B_1_1');
  });
});

