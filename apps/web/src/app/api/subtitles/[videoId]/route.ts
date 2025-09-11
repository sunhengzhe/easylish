import { NextRequest, NextResponse } from 'next/server';
import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
  const { videoId } = await params;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // 当前由 vector-api 管理字幕数据，未提供按视频聚合的接口
    return NextResponse.json(
      { error: 'Not implemented: served by vector-api' },
      { status: 501 }
    );

  } catch (error) {
    console.error('Subtitle API error:', error);
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
