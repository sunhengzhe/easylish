#!/usr/bin/env node
/*
  Transcribe a video/audio file to SRT using the local open-source Whisper CLI.
  Requires: `pip install openai-whisper` (and recommended `ffmpeg`).
*/

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'data', 'subtitles');

function parseArgs(argv) {
  const args = { language: undefined, model: undefined, out: undefined, modelDir: undefined, oneSentence: true };
  const positionals = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--language') args.language = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--model_dir' || a === '--model-dir') args.modelDir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--one_sentence' || a === '--one-sentence') args.oneSentence = true;
    else if (a === '--no_one_sentence' || a === '--no-one-sentence') args.oneSentence = false;
    else if (a === '--help' || a === '-h') args.help = true;
    else positionals.push(a);
  }
  return { args, positionals };
}

function usage() {
  console.log(`Usage: node scripts/transcribe.mjs <input_file> [--out out.srt] [--language zh|en|...] [--model tiny|base|small|medium|large[.en]] [--model_dir /path/to/models] [--one_sentence|--no_one_sentence]\n`);
}

function srtTimeToMs(t) {
  // format: HH:MM:SS,mmm
  const m = t.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!m) return 0;
  const [_, hh, mm, ss, ms] = m;
  return parseInt(hh) * 3600000 + parseInt(mm) * 60000 + parseInt(ss) * 1000 + parseInt(ms);
}

function msToSrtTime(ms) {
  const sign = ms < 0 ? '-' : '';
  ms = Math.max(0, Math.floor(Math.abs(ms)));
  const hh = String(Math.floor(ms / 3600000)).padStart(2, '0');
  ms %= 3600000;
  const mm = String(Math.floor(ms / 60000)).padStart(2, '0');
  ms %= 60000;
  const ss = String(Math.floor(ms / 1000)).padStart(2, '0');
  const mmm = String(ms % 1000).padStart(3, '0');
  return `${sign}${hh}:${mm}:${ss},${mmm}`;
}

function parseSrt(content) {
  const blocks = content.replace(/\r/g, '').split(/\n\n+/);
  const entries = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    // If first line is a number, skip it
    let idx = 0;
    if (/^\d+$/.test(lines[0].trim())) idx = 1;
    const timeLine = lines[idx++];
    const m = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!m) continue;
    const start = srtTimeToMs(m[1]);
    const end = srtTimeToMs(m[2]);
    const text = lines.slice(idx).join(' ').trim();
    if (text) entries.push({ start, end, text });
  }
  return entries;
}

function splitIntoSentences(text) {
  // Split by sentence-ending punctuation while keeping it attached.
  const re = /[^.!?。！？]+[.!?。！？]+[\"\'”）)]*/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].trim());
  }
  const remainder = text.slice(re.lastIndex).trim();
  if (remainder) out.push(remainder);
  return out;
}

function formatSrt(entries) {
  return entries
    .map((e, i) => `${i + 1}\n${msToSrtTime(e.start)} --> ${msToSrtTime(e.end)}\n${e.text}\n`)
    .join('\n');
}

function resegmentToSentences(entries) {
  // Merge all entries into groups and split into sentences, then allocate time proportionally by character length.
  const results = [];
  let buffer = '';
  let groupStart = null;
  let groupEnd = null;

  function flushGroup() {
    if (!buffer.trim()) return;
    const sentences = splitIntoSentences(buffer.trim());
    const totalChars = sentences.reduce((acc, s) => acc + s.length, 0) || 1;
    const start = groupStart ?? 0;
    const end = groupEnd ?? start;
    const totalDur = Math.max(1, end - start);
    let cursor = start;
    for (const s of sentences) {
      const dur = Math.max(500, Math.round((s.length / totalChars) * totalDur)); // min 0.5s per sentence
      const sEnd = Math.min(end, cursor + dur);
      results.push({ start: cursor, end: sEnd, text: s });
      cursor = sEnd;
    }
    buffer = '';
    groupStart = null;
    groupEnd = null;
  }

  for (const e of entries) {
    if (groupStart == null) groupStart = e.start;
    groupEnd = e.end;
    buffer += (buffer ? ' ' : '') + e.text;
    // If buffer ends with sentence-ending punctuation, flush now; else continue merging
    if (/[.!?。！？][\"\'”）)]*$/.test(buffer)) {
      flushGroup();
    }
  }
  flushGroup();
  // Reindex not necessary here; formatSrt handles numbering.
  return results;
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function which(cmd) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd]);
    child.on('error', () => resolve(null));
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function transcribeWithLocalWhisper(inputPath, outPath, language, model) {
  const whisperPath = await which('whisper');
  if (!whisperPath) {
    console.error('`whisper` CLI not found. Install via: pip install openai-whisper');
    process.exit(1);
  }
  const outDir = path.dirname(outPath);
  await ensureDir(outDir);

  const args = [
    inputPath,
    '--task', 'transcribe',
    '--output_format', 'srt',
    '--output_dir', outDir,
  ];
  if (language) args.push('--language', language);
  if (model) args.push('--model', model);
  if (arguments?.length >= 5) {
    // pass-through for modelDir from outer scope when available
  }

  await run(whisperPath, args);

  // whisper writes <basename>.<format> next to input or in output_dir
  const base = path.basename(inputPath, path.extname(inputPath));
  const produced = path.join(outDir, `${base}.srt`);
  const target = outPath;
  if (produced !== target) {
    // If the output name differs (e.g., user specified outPath with different base), move/rename.
    if (await fileExists(produced)) {
      await fs.rename(produced, target).catch(async () => {
        const data = await fs.readFile(produced);
        await fs.writeFile(target, data);
        await fs.unlink(produced);
      });
    }
  }
}

async function main() {
  const { args, positionals } = parseArgs(process.argv);
  if (args.help || positionals.length < 1) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.resolve(positionals[0]);
  if (!(await fileExists(inputPath))) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  const defaultOut = path.join(DEFAULT_OUTPUT_DIR, `${path.basename(inputPath, path.extname(inputPath))}.srt`);
  const outPath = path.resolve(args.out || defaultOut);
  await ensureDir(path.dirname(outPath));

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outPath}`);
  if (args.language) console.log(`Language: ${args.language}`);
  if (args.model) console.log(`Model: ${args.model}`);
  if (args.modelDir) console.log(`Model dir: ${args.modelDir}`);

  // Build extra options for whisper CLI, including optional model_dir
  const whisperPath = await which('whisper');
  if (!whisperPath) {
    console.error('`whisper` CLI not found. Install via: pip install openai-whisper');
    process.exit(1);
  }
  const outDir = path.dirname(outPath);
  await ensureDir(outDir);

  const whisperArgs = [
    inputPath,
    '--task', 'transcribe',
    '--output_format', 'srt',
    '--output_dir', outDir,
  ];
  if (args.language) whisperArgs.push('--language', args.language);
  if (args.model) whisperArgs.push('--model', args.model);
  if (args.modelDir) whisperArgs.push('--model_dir', path.resolve(args.modelDir));

  await run(whisperPath, whisperArgs);

  // Whisper produced file path
  const base = path.basename(inputPath, path.extname(inputPath));
  const produced = path.join(outDir, `${base}.srt`);
  const target = outPath;
  if (produced !== target) {
    if (await fileExists(produced)) {
      await fs.rename(produced, target).catch(async () => {
        const data = await fs.readFile(produced);
        await fs.writeFile(target, data);
        await fs.unlink(produced);
      });
    }
  }

  if (args.oneSentence) {
    try {
      const raw = await fs.readFile(target, 'utf8');
      const parsed = parseSrt(raw);
      const sentenceEntries = resegmentToSentences(parsed);
      const srt = formatSrt(sentenceEntries);
      await fs.writeFile(target, srt, 'utf8');
      console.log('Post-processed to one sentence per subtitle.');
    } catch (e) {
      console.warn('Sentence post-processing failed, leaving original SRT. Reason:', e?.message || e);
    }
  }

  console.log(`SRT written: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
