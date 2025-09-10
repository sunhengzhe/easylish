export interface EmbeddingsProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
}

// A small, deterministic embedding provider based on hashing tokens.
// This is a placeholder to keep the module self-contained and swappable.
export class HashEmbeddingsProvider implements EmbeddingsProvider {
  readonly dimension: number;

  constructor(dimension = 256) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const vec = new Array(this.dimension).fill(0);
    const lower = text.toLowerCase();
    const wordTokens = lower.split(/\s+/).filter(Boolean);

    // Add character bigrams to better support languages without spaces (e.g., Chinese)
    const chars = Array.from(lower.matchAll(/[\p{L}\p{N}]/gu), m => m[0]);
    const charBigrams: string[] = [];
    for (let i = 0; i < chars.length - 1; i++) {
      charBigrams.push(chars[i] + chars[i + 1]);
    }

    const tokens = [...wordTokens, ...charBigrams];
    for (const token of tokens) {
      const h = this.hash(token);
      // Signed hashing to spread signal
      const idx = Math.abs(h) % this.dimension;
      vec[idx] += h >= 0 ? 1 : -1;
    }
    return this.l2Normalize(vec);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const t of texts) out.push(await this.embed(t));
    return out;
  }

  private hash(s: string): number {
    // Simple FNV-1a 32-bit hash
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    // Convert to signed 32-bit range
    return (h | 0);
  }

  private l2Normalize(vec: number[]): number[] {
    let norm = 0;
    for (const x of vec) norm += x * x;
    norm = Math.sqrt(norm) || 1;
    return vec.map(x => x / norm);
  }
}
