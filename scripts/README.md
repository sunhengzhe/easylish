## Video Transcription Tool (Completely Rewritten)

**Location**: `scripts/transcribe.mjs`
**Goal**: Convert video/audio files to sentence-level SRT subtitles using Whisper's word-level timestamps.

### ✨ Key Features

- **Smart Sentence Segmentation**: Uses word-level timestamps for accurate sentence boundaries
- **Multiple Segmentation Strategies**: Punctuation, line length, duration, and silence gap detection
- **Industry Best Practices**: No complex post-processing, leverages Whisper's native capabilities
- **Configurable Parameters**: Fine-tune segmentation behavior

### 📋 Requirements

- **Node.js 18+**
- **Whisper CLI**: `pip install openai-whisper`
- **FFmpeg** (recommended): `brew install ffmpeg` (macOS)

### 🚀 Quick Setup

```bash
# Install Whisper
pip install openai-whisper

# Install FFmpeg (macOS)
brew install ffmpeg

# Test the script
node scripts/transcribe.mjs --help
```

### 💡 Usage

**Basic usage:**

```bash
pnpm transcribe:local /path/to/video.mp4 --language en
```

**Advanced usage:**

```bash
pnpm transcribe:local /path/to/video.mp4 \
  --language en \
  --model base \
  --out data/subtitles/my-video.srt \
  --max-line-width 60 \
  --max-line-duration 5 \
  --min-silence-gap 0.5
```

### ⚙️ Parameters

| Parameter             | Description                    | Default                     | Example                            |
| --------------------- | ------------------------------ | --------------------------- | ---------------------------------- |
| `--language`          | Language code                  | auto-detect                 | `en`, `zh`, `es`                   |
| `--model`             | Whisper model size             | `base`                      | `tiny`, `small`, `medium`, `large` |
| `--out`               | Output SRT file                | `data/subtitles/<name>.srt` | `my-subtitles.srt`                 |
| `--max-line-width`    | Max characters per line        | `50`                        | `60`                               |
| `--max-line-duration` | Max seconds per subtitle       | `6`                         | `5`                                |
| `--min-silence-gap`   | Min silence for sentence break | `0.3`                       | `0.5`                              |

### 🎯 How It Works

1. **Word-Level Timestamps**: Uses `--word_timestamps True` to get precise timing
2. **JSON Processing**: Processes Whisper's rich JSON output instead of raw SRT
3. **Smart Segmentation**: Combines punctuation, length, duration, and silence detection
4. **Clean Output**: Generates clean, sentence-level SRT files

### ✅ Example Output

**Before** (long paragraphs):

```
1
00:00:00,000 --> 00:00:20,580
Hello what can I do for you? Hello I'd like to buy some notebooks. What kind of notebooks would you like?
```

**After** (sentence-level):

```
1
00:00:00,000 --> 00:00:03,240
Hello what can I do for you?

2
00:00:03,240 --> 00:00:06,180
Hello I'd like to buy some notebooks.

3
00:00:06,180 --> 00:00:09,420
What kind of notebooks would you like?
```

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
