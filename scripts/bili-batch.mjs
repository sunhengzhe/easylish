#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function which(cmd) {
  return new Promise((resolve) => {
    const child = spawn(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'pipe' });
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', (code) => resolve(code === 0 ? out.trim() : null));
    child.on('error', () => resolve(null));
  });
}

function usage() {
  console.log(`Usage: node scripts/bili-batch.mjs --videoId <BV...> --range <start-end> [--language en]

Examples:
  node scripts/bili-batch.mjs --videoId BV1ji421Y7y7 --range 2-10 --language en
  pnpm node scripts/bili-batch.mjs -- --videoId BV1ji421Y7y7 --range 2-10

Notes:
  - Requires you-get (Python). If missing, install via: uv pip install you-get
  - Transcription uses Whisper CLI. If missing, install via: uv pip install openai-whisper
  - Download dir: ./data/video; SRT output handled by pnpm transcribe:local
`);
}

function parseArgs(argv) {
  const out = { videoId: null, range: null, language: 'en' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--videoId') out.videoId = argv[++i];
    else if (a === '--range') out.range = argv[++i];
    else if (a === '--language') out.language = argv[++i];
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function parseRange(spec) {
  if (!spec || !/^[0-9]+-[0-9]+$/.test(spec)) return null;
  const [s, e] = spec.split('-').map((x) => parseInt(x, 10));
  if (!(s >= 1 && e >= s)) return null;
  return { start: s, end: e };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }
  const rng = parseRange(args.range);
  if (!args.videoId || !rng) {
    usage();
    process.exit(1);
  }

  const downloadDir = path.resolve(process.cwd(), 'data', 'video');
  await ensureDir(downloadDir);

  // Resolve you-get: prefer local you-get; fallback to uvx you-get
  const youGetPath = (await which('you-get')) || (await which('uvx'));
  const useUvx = !!youGetPath && youGetPath.endsWith('/uvx');
  if (!youGetPath) {
    console.error('you-get not found. Install via: uv pip install you-get');
    process.exit(1);
  }

  // Check pnpm availability
  const pnpmPath = await which('pnpm');
  if (!pnpmPath) {
    console.error('pnpm not found. Please install pnpm to proceed.');
    process.exit(1);
  }

  // Check whisper availability (transcribe.mjs calls `whisper` CLI internally)
  const whisperPath = await which('whisper');
  if (!whisperPath) {
    console.warn('[warn] `whisper` CLI not found on PATH.');
    console.warn('       Install via: uv pip install openai-whisper');
    console.warn('       or ensure your uv/venv is activated so `whisper` is available.');
  }

  for (let p = rng.start; p <= rng.end; p++) {
    const url = `https://www.bilibili.com/video/${args.videoId}?p=${p}`;
    const fileId = `${args.videoId}_${p}`;
    const filename = `${fileId}.mp4`;
    const outPath = path.join(downloadDir, filename);

    console.log(`\n=== [${p}] Downloading: ${url}`);
    const ygArgs = useUvx
      ? ['you-get', '-o', downloadDir, '-O', fileId, url]
      : ['-o', downloadDir, '-O', fileId, url];
    const ygCmd = useUvx ? 'uvx' : 'you-get';
    const code = await run(ygCmd, ygArgs, { cwd: process.cwd() });
    if (code !== 0) {
      console.warn(`you-get failed for p=${p}; skipping transcription.`);
      continue;
    }

    // Verify file exists (some sites may produce different extensions)
    let exists = false;
    try {
      const st = await fs.stat(outPath);
      exists = st.isFile();
    } catch {}
    if (!exists) {
      console.warn(`Downloaded file not found at ${outPath}. Skipping transcription.`);
      continue;
    }

    console.log(`Transcribing: ${outPath} (language=${args.language || 'en'})`);
    const tCode = await run('pnpm', ['transcribe:local', outPath, '--language', args.language || 'en']);
    if (tCode !== 0) {
      console.warn(`Transcription failed for p=${p}.`);
    }

    // Cleanup video and related XMLs to save disk space
    try {
      await fs.unlink(outPath);
      console.log(`Deleted: ${outPath}`);
    } catch (e) {
      console.warn(`Failed to delete ${outPath}: ${e?.message || e}`);
    }

    // Try common XML filenames for bilibili danmaku/metadata
    const base = `${args.videoId}_${p}`;
    const xmlCandidates = [
      path.join(downloadDir, `${base}.xml`),
      path.join(downloadDir, `${base}.cmt.xml`),
      path.join(downloadDir, `${base}.danmaku.xml`),
    ];
    for (const xp of xmlCandidates) {
      try {
        await fs.unlink(xp);
        console.log(`Deleted: ${xp}`);
      } catch {}
    }
    // Fallback: remove any .xml in downloadDir that contains the base name
    try {
      const all = await fs.readdir(downloadDir);
      await Promise.all(
        all
          .filter((f) => f.endsWith('.xml') && f.includes(base))
          .map((f) => fs.unlink(path.join(downloadDir, f)).then(() => console.log(`Deleted: ${path.join(downloadDir, f)}`)).catch(() => {}))
      );
    } catch {}
  }

  console.log('\nAll done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
