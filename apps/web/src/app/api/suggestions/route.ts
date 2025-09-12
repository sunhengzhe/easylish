import { NextRequest, NextResponse } from 'next/server';
import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const searchService = SubtitleSearchService.getInstance();
    // 兼容：用向量检索的 payload 文本生成建议（简单截断/去重）
    const vector = await searchService.searchVectorTopK(query, limit * 2);
    const texts: string[] = (vector.results || [])
      .map((r) => String(r.entry?.text || ''))
      .filter(Boolean);
    const uniq = Array.from(new Set(texts));
    const suggestions = uniq.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        query,
        suggestions,
        count: suggestions.length,
      },
    });

  } catch (error) {
    console.error('Suggestions API error:', error);
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
