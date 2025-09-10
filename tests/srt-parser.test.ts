import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

import { SRTParser } from '@/lib/parsers/srt-parser';

const TMP_DIR = path.join(process.cwd(), 'tests', 'tmp-srt');

const SAMPLE_SRT = `1\n00:00:01,000 --> 00:00:03,000\nHello Parser\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond line here\n`;

describe('SRTParser - filename extraction and parsing', () => {
  beforeAll(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
  });

  it('parses video id and episode from filename with underscore', async () => {
    const file = path.join(TMP_DIR, 'VID123_2.srt');
    await fs.writeFile(file, SAMPLE_SRT, 'utf-8');

    const result = await SRTParser.parseSRTFile(file);
    expect(result.videoId).toBe('VID123');
    expect(result.episodeNumber).toBe(2);
    expect(result.entries.length).toBe(2);
    expect(result.entries[0].id).toBe('VID123_2_1');
    expect(result.entries[0].startTime).toBe(1000);
    expect(result.entries[1].startTime).toBe(4000);
  });

  it('defaults episode to 1 when no underscore', async () => {
    const file = path.join(TMP_DIR, 'VID456.srt');
    await fs.writeFile(file, SAMPLE_SRT, 'utf-8');

    const result = await SRTParser.parseSRTFile(file);
    expect(result.videoId).toBe('VID456');
    expect(result.episodeNumber).toBe(1);
    expect(result.entries[0].id).toBe('VID456_1_1');
  });

  it('normalizes text with unicode support (Chinese kept)', async () => {
    const file = path.join(TMP_DIR, 'VIDCN_1.srt');
    const cn = `1\n00:00:00,000 --> 00:00:01,000\n早上好，世界！\n`;
    await fs.writeFile(file, cn, 'utf-8');
    const result = await SRTParser.parseSRTFile(file);
    expect(result.entries[0].normalizedText).toContain('早上好');
  });
});

