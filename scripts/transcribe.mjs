#!/usr/bin/env node
/*
  Transcribe a video/audio file to SRT using Whisper with word-level timestamps.
  Optimized for sentence-level segmentation using industry best practices.
*/

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';

const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'data', 'subtitles');

function parseArgs(argv) {
  const args = {
    language: undefined,
    model: 'base',
    out: undefined,
    modelDir: undefined,
    maxLineWidth: 50,
    maxLineDuration: 6,
    minSilenceGap: 0.3
  };
  const positionals = [];

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--language') args.language = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--model_dir' || a === '--model-dir') args.modelDir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--max-line-width') args.maxLineWidth = parseInt(argv[++i]) || 50;
    else if (a === '--max-line-duration') args.maxLineDuration = parseFloat(argv[++i]) || 6;
    else if (a === '--min-silence-gap') args.minSilenceGap = parseFloat(argv[++i]) || 0.3;
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
  --max-line-width <num>    Maximum characters per line (default: 50)
  --max-line-duration <sec> Maximum duration per subtitle (default: 6s)
  --min-silence-gap <sec>   Minimum silence for sentence break (default: 0.3s)
  --help, -h               Show this help

Example:
  node scripts/transcribe.mjs video.mp4 --language en --out subtitles.srt
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

function formatSrt(segments) {
  return segments
    .map((segment, index) => {
      const startTime = msToSrtTime(segment.start * 1000);
      const endTime = msToSrtTime(segment.end * 1000);
      return `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n`;
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

function segmentBySentences(words, options = {}) {
  const { maxLineWidth = 50, maxLineDuration = 6, minSilenceGap = 0.3 } = options;
  const segments = [];

  let currentSegment = {
    start: null,
    end: null,
    words: []
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const nextWord = words[i + 1];

    // 初始化段落开始时间
    if (currentSegment.start === null) {
      currentSegment.start = word.start;
    }

    currentSegment.words.push(word);
    currentSegment.end = word.end;

    // 计算当前段落的统计信息
    const currentText = currentSegment.words.map(w => w.word).join(' ').trim();
    const currentDuration = currentSegment.end - currentSegment.start;

    // 判断是否应该结束当前段落
    let shouldEndSegment = false;

    // 1. 遇到句末标点符号
    if (word.word.match(/[.!?。！？]/)) {
      shouldEndSegment = true;
    }

    // 2. 行长度超限
    else if (currentText.length >= maxLineWidth) {
      shouldEndSegment = true;
    }

    // 3. 时长超限
    else if (currentDuration >= maxLineDuration) {
      shouldEndSegment = true;
    }

    // 4. 检测到显著的静音间隙（如果有下一个词的话）
    else if (nextWord && (nextWord.start - word.end) >= minSilenceGap) {
      shouldEndSegment = true;
    }

    // 5. 到达最后一个词
    else if (i === words.length - 1) {
      shouldEndSegment = true;
    }

    if (shouldEndSegment && currentSegment.words.length > 0) {
      segments.push({
        start: currentSegment.start,
        end: currentSegment.end,
        text: currentText
      });

      // 重置当前段落
      currentSegment = {
        start: null,
        end: null,
        words: []
      };
    }
  }

  return segments;
}

async function processWhisperJson(jsonPath, options) {
  const jsonData = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

  // 提取所有词级时间戳
  const allWords = [];
  for (const segment of jsonData.segments) {
    if (segment.words) {
      allWords.push(...segment.words);
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

  // 基于词级时间戳进行智能分句
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
      maxLineWidth: args.maxLineWidth,
      maxLineDuration: args.maxLineDuration,
      minSilenceGap: args.minSilenceGap
    });

    // Step 4: Generate SRT
    const srtContent = formatSrt(segments);
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

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});