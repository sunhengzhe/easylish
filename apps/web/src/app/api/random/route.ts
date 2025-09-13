import { NextResponse } from 'next/server';
import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // 使用真正的随机台词功能
    const searchService = SubtitleSearchService.getInstance();
    const randomResult = await searchService.getRandomSubtitle();

    if (!randomResult) {
      return NextResponse.json(
        { error: 'No random subtitle found' },
        { status: 404 }
      );
    }

    // 记录日志（非生产环境）
    if (process.env.NODE_ENV !== 'production') {
      console.log('[api/random] true random:', {
        entryId: randomResult.entry.id,
        videoId: randomResult.entry.videoId,
        text: randomResult.entry.text.substring(0, 50) + '...',
        score: randomResult.score
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        result: randomResult,
        method: 'true_random', // 标识这是真正的随机结果
      }
    });

  } catch (error) {
    console.error('Random API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
