import type { EmbeddingsProvider } from './embeddings';

type MinimalTensor = { data: Float32Array; dims?: number[] };
type FeatureExtractor = (
  input: string | string[],
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<MinimalTensor | MinimalTensor[]>;

// Lightweight provider using @xenova/transformers to run a small multilingual model on CPU.
// Default model: intfloat/multilingual-e5-small (384-dim), good multilingual retrieval quality.
export class XenovaEmbeddingsProvider implements EmbeddingsProvider {
  private extractorPromise: Promise<FeatureExtractor> | null = null;
  readonly dimension: number;

  constructor(
    private modelId = process.env.MODEL_ID || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    private normalize = true
  ) {
    // e5-small output dimension
    this.dimension = 384;
  }

  private async getExtractor(): Promise<FeatureExtractor> {
    if (!this.extractorPromise) {
      // Dynamic import to avoid bundling/SSR issues when not enabled
      type TransformersModule = { pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<FeatureExtractor> };
      const mod = (await import('@xenova/transformers')) as unknown as TransformersModule;
      try {
        // Prefer quantized model for speed if available
        this.extractorPromise = mod.pipeline('feature-extraction', this.modelId, { quantized: true });
      } catch (err) {
        // Fallback to non-quantized if quantized artifacts are unavailable
        this.extractorPromise = mod.pipeline('feature-extraction', this.modelId, { quantized: false });
      }
    }
    return this.extractorPromise;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const input = this.format(text, 'query');
    const out = await extractor(input, { pooling: 'mean', normalize: this.normalize });
    const tensor = out as MinimalTensor;
    // If dims indicate [1, dim], return first row
    if (tensor.dims && tensor.dims.length >= 2 && tensor.dims[0] === 1) {
      const dim = tensor.dims[tensor.dims.length - 1];
      return Array.from(tensor.data.slice(0, dim));
    }
    return Array.from(tensor.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const extractor = await this.getExtractor();
    const inputs = texts.map((t) => this.format(t, 'passage'));
    const out = await extractor(inputs, { pooling: 'mean', normalize: this.normalize });
    // Depending on version, batched output may be an array or a single object
    if (Array.isArray(out)) {
      return (out as MinimalTensor[]).map((o) => Array.from(o.data));
    }
    const tensor = out as MinimalTensor;
    if (tensor.dims && tensor.dims.length >= 2) {
      const dims = tensor.dims;
      const batch = dims[0];
      const dim = dims[dims.length - 1];
      const flat = Array.from(tensor.data);
      if (batch * dim === flat.length) {
        const chunks: number[][] = [];
        for (let i = 0; i < batch; i++) {
          const start = i * dim;
          chunks.push(flat.slice(start, start + dim));
        }
        return chunks;
      }
    }
    // Fallback assume single vector
    return [Array.from(tensor.data)];
  }

  private format(text: string, type: 'query' | 'passage') {
    // E5-style instruction formatting improves retrieval
    return type === 'query' ? `query: ${text}` : `passage: ${text}`;
  }
}
