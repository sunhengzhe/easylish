import { describe, it, expect } from 'vitest';
// Import ESM module
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { segmentBySentences, wrapText } from '../../scripts/transcribe.mjs';

describe('segmentBySentences', () => {
  it('splits English into one sentence per cue', () => {
    const words = [
      { word: 'Hello', start: 0.0, end: 0.2 },
      { word: 'world', start: 0.21, end: 0.4 },
      { word: '.', start: 0.41, end: 0.45 },
      { word: 'How', start: 1.2, end: 1.4 },
      { word: 'are', start: 1.41, end: 1.5 },
      { word: 'you', start: 1.51, end: 1.7 },
      { word: '?', start: 1.71, end: 1.75 },
    ];
    const segs = segmentBySentences(words, { language: 'en', minSilenceGap: 0.5 });
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe('Hello world.');
    expect(segs[1].text).toBe('How are you?');
  });

  it('does not split after abbreviation like Dr.', () => {
    const words = [
      { word: 'Dr.', start: 0.0, end: 0.2 },
      { word: 'Smith', start: 0.21, end: 0.4 },
      { word: 'is', start: 0.41, end: 0.5 },
      { word: 'here', start: 0.51, end: 0.7 },
      { word: '.', start: 0.71, end: 0.75 },
    ];
    const segs = segmentBySentences(words, { language: 'en', minSilenceGap: 1.0 });
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe('Dr. Smith is here.');
  });

  it('handles Chinese sentences', () => {
    const words = [
      { word: '今', start: 0.0, end: 0.1 },
      { word: '天', start: 0.1, end: 0.2 },
      { word: '天', start: 0.2, end: 0.3 },
      { word: '气', start: 0.3, end: 0.4 },
      { word: '很', start: 0.4, end: 0.5 },
      { word: '好', start: 0.5, end: 0.6 },
      { word: '。', start: 0.6, end: 0.65 },
      { word: '我', start: 1.5, end: 1.6 },
      { word: '们', start: 1.6, end: 1.7 },
      { word: '去', start: 1.7, end: 1.8 },
      { word: '公', start: 1.8, end: 1.9 },
      { word: '园', start: 1.9, end: 2.0 },
      { word: '吧', start: 2.0, end: 2.1 },
      { word: '？', start: 2.1, end: 2.15 },
    ];
    const segs = segmentBySentences(words, { language: 'zh', minSilenceGap: 0.6 });
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe('今天天气很好。');
    expect(segs[1].text).toBe('我们去公园吧？');
  });
});

describe('wrapText', () => {
  it('wraps to max width with spaces', () => {
    const text = 'This is a long sentence that should wrap nicely';
    const lines = wrapText(text, 12, 2, 'en');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].length).toBeLessThanOrEqual(12);
  });

  it('wraps CJK by characters', () => {
    const text = '这是一个比较长的句子需要换行显示';
    const lines = wrapText(text, 8, 2, 'zh');
    expect(lines[0].length).toBeLessThanOrEqual(8);
  });
});

