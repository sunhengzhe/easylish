#!/usr/bin/env node
/*
  Transcribe a video/audio file to SRT using Whisper with word-level timestamps.
  Goal: one sentence per subtitle cue (no more, no less),
  with robust handling for CJK languages and common English abbreviations.

  Best-practice approach:
  - Use Whisper's word timestamps to align boundaries to audio.
  - End cues only at sentence boundaries: sentence-ending punctuation or significant silence.
  - Never split a sentence due to width/time; wrap lines inside a cue for readability.
*/

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'data', 'subtitles');

function parseArgs(argv) {
  const args = {
    language: undefined,
    model: 'base',
    out: undefined,
    modelDir: undefined,
    wrap: true,
    maxLineWidth: 42,
    maxLines: 2,
    minSilenceGap: 0.5
  };
  const positionals = [];

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--language') args.language = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--model_dir' || a === '--model-dir') args.modelDir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--wrap') args.wrap = argv[++i] !== 'false';
    else if (a === '--max-line-width') args.maxLineWidth = parseInt(argv[++i]) || 42;
    else if (a === '--max-lines') args.maxLines = parseInt(argv[++i]) || 2;
    else if (a === '--min-silence-gap') args.minSilenceGap = parseFloat(argv[++i]) || 0.5;
    else if (a === '--help' || a === '-h') args.help = true;
    else positionals.push(a);
  }
  return { args, positionals };
}

function usage() {
  console.log(`Usage: node scripts/transcribe.mjs <input_file> [options]

Options:
  --out <file>              Output SRT file path
  --language <lang>         Language code (en, zh, etc.)
  --model <model>           Whisper model (tiny, base, small, medium, large)
  --model-dir <dir>         Directory containing model files
  --wrap <true|false>       Wrap lines inside a cue (default: true)
  --max-line-width <num>    Max characters per line when wrapping (default: 42)
  --max-lines <num>         Max lines per cue when wrapping (default: 2)
  --min-silence-gap <sec>   Minimum silence for sentence boundary (default: 0.5s)
  --help, -h               Show this help

Example:
  node scripts/transcribe.mjs video.mp4 --language en

Default output: if --out is omitted, writes to data/subtitles/<video_basename>.srt
`);
}

function msToSrtTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function wrapText(text, maxLineWidth = 42, maxLines = 2, language) {
  // For CJK languages, we allow wrapping by character; for others, wrap by words
  const isCJK = ['zh', 'ja', 'ko', 'zh-cn', 'zh-tw'].includes((language || '').toLowerCase());
  const lines = [];
  if (!text) return lines;

  if (isCJK) {
    let line = '';
    for (const ch of text) {
      line += ch;
      if (line.length >= maxLineWidth && lines.length < maxLines - 1) {
        lines.push(line);
        line = '';
      }
    }
    if (line) lines.push(line);
  } else {
    const words = text.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      if (!line.length) {
        line = w;
        continue;
      }
      if ((line + ' ' + w).length <= maxLineWidth || lines.length >= maxLines - 1) {
        line += ' ' + w;
      } else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function formatSrt(segments, options = {}) {
  const { wrap = true, maxLineWidth = 42, maxLines = 2, language } = options;
  return segments
    .map((segment, index) => {
      const startTime = msToSrtTime(segment.start * 1000);
      const endTime = msToSrtTime(segment.end * 1000);
      const text = segment.text.trim();
      const content = wrap ? wrapText(text, maxLineWidth, maxLines, language).join('\n') : text;
      return `${index + 1}\n${startTime} --> ${endTime}\n${content}\n`;
    })
    .join('\n');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function which(cmd) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'pipe' });
    child.on('error', () => resolve(null));
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', (code) => resolve(code === 0 ? out.trim() : null));
  });
}

async function runWhisper(inputPath, outputDir, args) {
  return new Promise((resolve, reject) => {
    const whisperArgs = [
      inputPath,
      '--task', 'transcribe',
      '--output_format', 'json',  // 使用 JSON 输出获得更丰富的信息
      '--word_timestamps', 'True',  // 启用词级时间戳
      '--temperature', '0',         // 稳定输出有利于精准分句
      '--verbose', 'False',         // 减少控制台噪音
      '--output_dir', outputDir,
    ];

    if (args.language) whisperArgs.push('--language', args.language);
    if (args.model) whisperArgs.push('--model', args.model);
    if (args.modelDir) whisperArgs.push('--model_dir', path.resolve(args.modelDir));

    console.log('Running whisper with word-level timestamps...');
    const child = spawn('whisper', whisperArgs, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`whisper exited with code ${code}`));
    });
  });
}

// Common English abbreviations that should not trigger sentence end on '.'
const EN_ABBREVIATIONS = new Set([
  'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.', 'vs.', 'etc.', 'e.g.', 'i.e.', 'fig.', 'al.', 'est.', 'no.', 'co.'
]);

function isCJKChar(ch) {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4DBF) || // CJK Unified Ideographs Extension A
    (code >= 0x3040 && code <= 0x30FF) || // Hiragana & Katakana
    (code >= 0xAC00 && code <= 0xD7AF)    // Hangul Syllables
  );
}

function needsSpaceBetween(prev, curr) {
  if (!prev) return false;
  const a = prev.slice(-1);
  const b = curr.slice(0, 1);
  // No extra space for CJK adjacency
  if (isCJKChar(a) || isCJKChar(b)) return false;
  // No space before closing punctuation
  if (/^[,.;!?)}\]\%:\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F]$/.test(b)) return false;
  // No space after opening quotes/brackets
  if (/^[({\[\u3008\u300A\u201C\u2018]$/.test(a)) return false;
  return true;
}

function normalizeToken(t) {
  // Whisper often includes leading spaces in word tokens; preserve text but trim for checks
  return (t ?? '').replace(/\s+/g, ' ');
}

function joinTokens(tokens) {
  let s = '';
  for (const tok of tokens) {
    const clean = normalizeToken(tok);
    if (!clean) continue;
    if (s && needsSpaceBetween(s.slice(-1), clean)) s += ' ';
    s += clean;
  }
  // Cleanup spaces around CJK punctuation
  s = s.replace(/\s*([\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F，。！？；：])\s*/g, '$1');
  s = s.replace(/\s+([,.;!?])/g, '$1');
  return s.trim();
}

function looksLikeAbbreviation(prevText, language) {
  if (!prevText) return false;
  if ((language || '').toLowerCase().startsWith('en')) {
    const lower = prevText.toLowerCase();
    // Check last up to 5 tokens for known abbreviations
    const parts = lower.split(/\s+/);
    const tail = parts.slice(-2).join(' ');
    return EN_ABBREVIATIONS.has(parts.slice(-1)[0]) || EN_ABBREVIATIONS.has(tail);
  }
  return false;
}

function isSentenceTerminator(token) {
  return /[.!?…。！？]/.test(token);
}

function segmentBySentences(words, options = {}) {
  const { minSilenceGap = 0.5, language } = options;
  const segments = [];
  let start = null;
  let end = null;
  let tokens = [];

  const flush = () => {
    if (!tokens.length) return;
    const text = joinTokens(tokens.map(w => w.word));
    segments.push({ start, end, text });
    start = null; end = null; tokens = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    if (start == null) start = w.start;
    end = w.end;
    const token = normalizeToken(w.word);
    // Skip non-speech tags like [Music]
    if (/^\s*\[[^\]]+\]\s*$/.test(token)) continue;
    tokens.push({ word: token, start: w.start, end: w.end });

    const isTerminator = isSentenceTerminator(token);
    const longGap = next ? (next.start - w.end) >= minSilenceGap : true; // true at EOF

    let shouldEnd = false;
    if (isTerminator) {
      // Avoid breaking after abbreviations (English)
      const prevText = joinTokens(tokens.map(t => t.word));
      if (!looksLikeAbbreviation(prevText, language)) shouldEnd = true;
    } else if (longGap) {
      // Significant silence implies sentence boundary even without punctuation
      shouldEnd = true;
    }

    if (shouldEnd) flush();
  }

  flush();
  return segments;
}

async function processWhisperJson(jsonPath, options) {
  const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

  // 提取所有词级时间戳
  const allWords = [];
  for (const segment of jsonData.segments) {
    if (segment.words) {
      allWords.push(...segment.words.map(w => ({
        word: typeof w.word === 'string' ? w.word : String(w.word ?? ''),
        start: w.start,
        end: w.end
      })));
    }
  }

  if (allWords.length === 0) {
    // 回退到原始段落，如果没有词级时间戳
    console.log('No word timestamps found, using original segments');
    return jsonData.segments.map(seg => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim()
    }));
  }

  console.log(`Processing ${allWords.length} words for sentence segmentation...`);

  // 基于词级时间戳进行严格的「一句一条」分句
  return segmentBySentences(allWords, options);
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
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
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const whisperPath = await which('whisper');
  if (!whisperPath) {
    console.error('`whisper` CLI not found. Install via: pip install openai-whisper');
    process.exit(1);
  }

  const defaultOut = path.join(DEFAULT_OUTPUT_DIR, `${path.basename(inputPath, path.extname(inputPath))}.srt`);
  const outPath = path.resolve(args.out || defaultOut);
  const outputDir = path.dirname(outPath);

  await ensureDir(outputDir);

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outPath}`);
  console.log(`Model: ${args.model}`);
  if (args.language) console.log(`Language: ${args.language}`);

  try {
    // Step 1: Run Whisper with word-level timestamps
    await runWhisper(inputPath, outputDir, args);

    // Step 2: Find generated JSON file
    const inputBasename = path.basename(inputPath, path.extname(inputPath));
    const jsonPath = path.join(outputDir, `${inputBasename}.json`);

    if (!(await fileExists(jsonPath))) {
      throw new Error(`Expected JSON output not found: ${jsonPath}`);
    }

    // Step 3: Process JSON and segment by sentences
    const segments = await processWhisperJson(jsonPath, {
      language: args.language,
      minSilenceGap: args.minSilenceGap
    });

    // Step 4: Generate SRT
    const srtContent = formatSrt(segments, {
      wrap: args.wrap,
      maxLineWidth: args.maxLineWidth,
      maxLines: args.maxLines,
      language: args.language
    });
    await fs.writeFile(outPath, srtContent, 'utf8');

    // Step 5: Clean up temporary JSON
    await fs.unlink(jsonPath).catch(() => {}); // Ignore errors

    console.log(`✅ Generated ${segments.length} subtitle segments`);
    console.log(`📁 SRT file saved: ${outPath}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const __FILENAME = fileURLToPath(import.meta.url);
const isCli = process.argv[1] && (__FILENAME === process.argv[1]);

if (isCli) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}

// Export internals for testing
export {
  wrapText,
  segmentBySentences,
};
