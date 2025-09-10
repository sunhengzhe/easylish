Transcript tooling (Open-source)

- Location: `scripts/`
- Goal: Convert a video/audio file into an SRT transcript using open-source Whisper models.

Mode

- Local Whisper: Uses the `whisper` CLI (from `pip install openai-whisper`).

Requirements

- Node.js 18+.
- `whisper` CLI available on PATH; recommended `ffmpeg` for better codec support.

Setup

pip install openai-whisper
# macOS example for ffmpeg
brew install ffmpeg

Usage

pnpm transcribe:local /absolute/path/to/video.mp4 \
  --out data/subtitles/356012463-1-192.srt \
  --language zh \
  --model medium \
  --one_sentence

Notes

- If `--out` is omitted, output goes to `data/subtitles/<basename>.srt`.
- `whisper` writes an SRT in the output directory; the script renames it to your `--out` when specified.
- Common models: `tiny`, `base`, `small`, `medium`, `large` (append `.en` for English-optimized variants).

Example (your file)

pnpm transcribe:local \
  /Users/sunhengzhe/Downloads/356012463-1-192.mp4 \
  --out data/subtitles/356012463-1-192.srt \
  --language zh \
  --one_sentence

Offline models (avoid network timeouts)

- First run downloads model weights; to avoid network, download manually and point `--model_dir` to that folder.
- Model files are named like `tiny.pt`, `tiny.en.pt`, `base.pt`, etc.
- Put them into a folder, e.g. `data/models/whisper`, then run with:

pnpm transcribe:local \
  /path/to/file.mp4 \
  --model tiny \
  --model_dir data/models/whisper

Tips

- Prefer `--model tiny` or `--model base` for the first run to reduce download size.
- Default output directory is created automatically: `data/subtitles`.
- Add `--one_sentence` (default enabled) to make each subtitle exactly one sentence; use `--no_one_sentence` to keep original segmenting.

Outputs

- Default: `data/subtitles/<input-basename>.srt` (directory auto-created).
- Use `--out` to override.

Troubleshooting

- `whisper` not found: install via `pip install openai-whisper`.
- `ffmpeg` not found: install via your OS package manager (recommended).
