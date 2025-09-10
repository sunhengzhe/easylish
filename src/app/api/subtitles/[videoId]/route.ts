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

    const searchService = SubtitleSearchService.getInstance();
    const videoSubtitle = await searchService.getVideoSubtitle(videoId);

    if (!videoSubtitle) {
      return NextResponse.json(
        { error: 'Video subtitle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: videoSubtitle,
    });

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
