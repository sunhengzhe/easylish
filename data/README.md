# Data Directory

This directory contains data files used by the application.

## Structure

- `subtitles/` - Contains SRT subtitle files
  - Place your `.srt` files here for subtitle parsing and processing
  - Files should be named according to their corresponding video IDs for easy matching
  - Example naming convention: `BV1B7411m7LV.srt`, `BV1fK6RYZEkd.srt`

## Usage

The subtitle files in this directory can be used by the API to:

- Parse subtitle content
- Extract timestamps
- Provide subtitle-based video navigation
- Enable search functionality within video content

## File Format

SRT files should follow the standard SRT format:

```
1
00:00:01,000 --> 00:00:04,000
First subtitle text

2
00:00:05,000 --> 00:00:08,000
Second subtitle text
```
