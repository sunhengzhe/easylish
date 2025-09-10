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
    const best = await searchService.getBestMatch(input.trim());

    if (!best) {
      return NextResponse.json(
        { error: 'No matching content found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      videoId: best.entry.videoId,
      startMs: best.entry.startTime,
      text: best.entry.text,
      score: best.score,
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
