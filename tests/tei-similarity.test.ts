import { describe, it, expect, beforeAll } from 'vitest';
import { embedPassage, isTeiAvailable } from './helpers/tei';
import { cosineSim } from './utils/similarity';

let available = true;

beforeAll(async () => {
  available = await isTeiAvailable();
});

describe('TEI embedding similarity', () => {
  it('CN vs EN weather sentences should be semantically close', async () => {
    if (!available) return expect(true).toBe(true);

    const cn = '今天天气很好';
    const en = 'The weather is nice today';
    const [v1, v2] = await embedPassage([cn, en]);
    const sim = cosineSim(v1, v2);

    // Assertions: valid range and conservative lower bound
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
    expect(sim).toBeGreaterThan(0.2);
  });

  it('Related pair ranks above unrelated by margin', async () => {
    if (!available) return expect(true).toBe(true);

    // Anchor on the same CN sentence to reduce global anisotropy effects
    const anchor = '今天天气很好';
    const positive = 'The weather is nice today';
    const negative = 'Bananas are elongated edible berries cultivated in tropical climates.';
    const [va, vp, vn] = await embedPassage([anchor, positive, negative]);
    const simPos = cosineSim(va, vp);
    const simNeg = cosineSim(va, vn);

    // Assertions: valid ranges and a relative margin
    for (const s of [simPos, simNeg]) {
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(simPos).toBeGreaterThan(simNeg + 0.2);
  });
});
