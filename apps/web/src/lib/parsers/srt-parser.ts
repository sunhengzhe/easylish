import { promises as fs } from 'fs';
import path from 'path';
import { SubtitleEntry, VideoSubtitle, SRTBlock } from '../types/subtitle';

export class SRTParser {
  /**
   * 解析单个 SRT 文件
   */
  static async parseSRTFile(filePath: string): Promise<VideoSubtitle> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { videoId, episodeNumber } = this.extractFromFilename(filePath);
      const blocks = this.parseSRTContent(content);
      const entries = this.convertBlocksToEntries(blocks, videoId, episodeNumber);

      return {
        videoId,
        episodeNumber,
        entries,
      };
    } catch (error) {
      console.error(`Error parsing SRT file ${filePath}:`, error);
      throw new Error(`Failed to parse SRT file: ${filePath}`);
    }
  }

  /**
   * 解析所有 SRT 文件
   */
  static async parseAllSRTFiles(subtitlesDir: string): Promise<VideoSubtitle[]> {
    try {
      const files = await fs.readdir(subtitlesDir);
      const srtFiles = files.filter(file => file.endsWith('.srt'));

      console.log(`Found ${srtFiles.length} SRT files to parse`);

      const parsePromises = srtFiles.map(file => {
        const filePath = path.join(subtitlesDir, file);
        return this.parseSRTFile(filePath);
      });

      const results = await Promise.allSettled(parsePromises);
      const successful: VideoSubtitle[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
          console.log(`✓ Parsed ${srtFiles[index]} - ${result.value.entries.length} entries`);
        } else {
          console.error(`✗ Failed to parse ${srtFiles[index]}:`, result.reason);
        }
      });

      return successful;
    } catch (error) {
      console.error('Error reading subtitles directory:', error);
      throw new Error('Failed to parse SRT files');
    }
  }

  /**
   * 从文件名提取视频 ID
   */
  private static extractFromFilename(filePath: string): { videoId: string; episodeNumber: number } {
    const filename = path.basename(filePath, '.srt');
    // 支持 BVxxxxx_2.srt（带集数），或 BVxxxxx.srt（默认第1集）
    const m = filename.match(/^(.*?)(?:_(\d+))?$/);
    const videoId = m?.[1] || filename;
    const episodeNumber = m?.[2] ? parseInt(m[2], 10) : 1;
    return { videoId, episodeNumber };
  }

  /**
   * 解析 SRT 内容为块
   */
  private static parseSRTContent(content: string): SRTBlock[] {
    const blocks: SRTBlock[] = [];
    const lines = content.split('\n').map(line => line.trim());

    let currentBlock: Partial<SRTBlock> = {};
    let state: 'sequence' | 'time' | 'text' = 'sequence';
    let textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === '') {
        // 空行表示一个块的结束
        if (currentBlock.sequence && currentBlock.startTime && currentBlock.endTime) {
          blocks.push({
            sequence: currentBlock.sequence,
            startTime: currentBlock.startTime,
            endTime: currentBlock.endTime,
            text: textLines.join(' ').trim(),
          });
        }

        // 重置状态
        currentBlock = {};
        textLines = [];
        state = 'sequence';
        continue;
      }

      switch (state) {
        case 'sequence':
          const sequenceNum = parseInt(line);
          if (!isNaN(sequenceNum)) {
            currentBlock.sequence = sequenceNum;
            state = 'time';
          }
          break;

        case 'time':
          const timeMatch = line.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
          if (timeMatch) {
            currentBlock.startTime = timeMatch[1];
            currentBlock.endTime = timeMatch[2];
            state = 'text';
          }
          break;

        case 'text':
          textLines.push(line);
          break;
      }
    }

    // 处理最后一个块（如果文件末尾没有空行）
    if (currentBlock.sequence && currentBlock.startTime && currentBlock.endTime && textLines.length > 0) {
      blocks.push({
        sequence: currentBlock.sequence,
        startTime: currentBlock.startTime,
        endTime: currentBlock.endTime,
        text: textLines.join(' ').trim(),
      });
    }

    return blocks;
  }

  /**
   * 将 SRT 块转换为 SubtitleEntry
   */
  private static convertBlocksToEntries(blocks: SRTBlock[], videoId: string, episodeNumber: number): SubtitleEntry[] {
    return blocks.map(block => {
      const startTime = this.timeStringToMilliseconds(block.startTime);
      const endTime = this.timeStringToMilliseconds(block.endTime);
      const duration = endTime - startTime;

      return {
        id: `${videoId}_${episodeNumber}_${block.sequence}`,
        videoId,
        episodeNumber,
        sequenceNumber: block.sequence,
        startTime,
        endTime,
        text: block.text,
        normalizedText: this.normalizeText(block.text),
        duration,
      };
    });
  }

  /**
   * 将时间字符串转换为毫秒
   * 格式: HH:MM:SS,mmm
   */
  private static timeStringToMilliseconds(timeString: string): number {
    const [time, milliseconds] = timeString.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);

    return (hours * 3600 + minutes * 60 + seconds) * 1000 + Number(milliseconds);
  }

  /**
   * 标准化文本用于搜索
   */
  private static normalizeText(text: string): string {
    // 使用 Unicode 属性，保留所有字母/数字字符与空白，支持多语言（含中文）
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
