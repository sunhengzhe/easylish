// A lightweight in-memory vector backend for tests/development without remote services.
// Provides upsert and search with deterministic scoring in [0,1].

export type LocalPayload = {
  video_id?: string;
  episode?: number;
  sequence?: number;
  start_ms?: number;
  end_ms?: number;
  text?: string;
  normalized_text?: string;
};

type LocalEntry = { id: string; payload: LocalPayload };

const store: LocalEntry[] = [];

export function reset() {
  store.length = 0;
}

export async function upsertEntries(entries: Array<{ id: string; text: string; video_id?: string; episode?: number }>) {
  for (const e of entries) {
    const existingIdx = store.findIndex((x) => x.id === e.id);
    const payload: LocalPayload = {
      video_id: e.video_id,
      episode: e.episode,
      text: e.text,
      normalized_text: normalize(e.text),
    };
    const ent: LocalEntry = { id: e.id, payload };
    if (existingIdx >= 0) store[existingIdx] = ent;
    else store.push(ent);
  }
  return entries.length;
}

export async function search(query: string, topK: number): Promise<Array<{ entryId: string; score: number; payload: LocalPayload }>> {
  const qnorm = normalize(query);
  const qtokens = tokenize(qnorm);
  const results = store.map((e) => {
    const t = e.payload.normalized_text || e.payload.text || '';
    const etokens = tokenize(t);
    const score = jaccardSim(qtokens, etokens);
    return { entryId: e.id, score, payload: e.payload };
  });
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, Math.max(1, Math.min(100, topK)));
}

// --- Helpers ---

function normalize(s: string): string {
  // lowercase, strip punctuation, apply simple bilingual mapping for common cases in tests
  let t = (s || '').toLowerCase();
  t = t.replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  t = mapBilingual(t);
  // very naive lemmatization: ducks -> duck
  t = t.replace(/\bducks\b/g, 'duck');
  t = t.replace(/\bwents\b/g, 'went');
  return t;
}

function tokenize(s: string): string[] {
  if (!s) return [];
  return s.split(/\s+/).filter(Boolean);
}

function jaccardSim(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  if (uni === 0) return 0;
  return inter / uni;
}

function mapBilingual(s: string): string {
  // Minimal mapping to make CN query comparable to EN phrases used in tests.
  // If sentence contains these Chinese tokens, map to approximate English equivalents.
  let out = s;
  // phrase-level mapping
  out = out.replace(/小鸭子去游泳/g, 'little ducks went swimming');
  // token-level mapping
  out = out.replace(/小鸭子/g, 'little ducks');
  out = out.replace(/小/g, 'little');
  out = out.replace(/鸭子/g, 'ducks');
  out = out.replace(/去/g, 'went');
  out = out.replace(/游泳/g, 'swimming');
  out = out.replace(/妈妈鸭|母鸭/g, 'mother duck');
  out = out.replace(/说/g, 'said');
  out = out.replace(/嘎嘎|呱呱/g, 'quack');
  return out;
}

