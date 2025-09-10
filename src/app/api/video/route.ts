import { NextRequest, NextResponse } from 'next/server';
import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    // 使用字幕搜索服务查找相关内容
    const searchService = SubtitleSearchService.getInstance();

    // 确保服务已初始化
    if (!searchService.isReady()) {
      await searchService.initialize();
    }
    const searchResults = await searchService.search({
      query: input.trim(),
      limit: 1, // 只取第一个最相关的结果
    });

    if (searchResults.results.length === 0) {
      return NextResponse.json(
        { error: 'No matching content found' },
        { status: 404 }
      );
    }

    const bestMatch = searchResults.results[0];

    return NextResponse.json({
      videoId: bestMatch.entry.videoId,
      startMs: bestMatch.entry.startTime,
      text: bestMatch.entry.text,
      score: bestMatch.score,
      success: true
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
