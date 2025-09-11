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

    const searchService = SubtitleSearchService.getInstance();
    const list = await searchService.searchVectorTopK(input.trim(), 1);
    const best = list.results?.[0];
    if (!best) {
      return NextResponse.json(
        { error: 'No matching content found' },
        { status: 404 }
      );
    }
    return NextResponse.json({
      videoId: best.entry.videoId,
      episode: best.entry.episodeNumber,
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
