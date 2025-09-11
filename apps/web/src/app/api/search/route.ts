import { NextRequest, NextResponse } from 'next/server';
import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';
import { SearchOptions } from '@/lib/types/subtitle';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // 解析搜索参数
    const options: SearchOptions = {
      query,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    // 视频ID过滤
    const videoIds = searchParams.get('videoIds');
    if (videoIds) {
      options.videoIds = videoIds.split(',').map(id => id.trim());
    }

    // 执行搜索（支持 strategy=vector|keyword，默认 keyword 保持兼容）
    const searchService = SubtitleSearchService.getInstance();

    // 服务应该已在启动时初始化，直接使用

    const strategy = (searchParams.get('strategy') || 'keyword').toLowerCase();
    const results = strategy === 'vector'
      ? await searchService.searchVectorTopK(options.query, options.limit ?? 20)
      : await searchService.search(options);

    if (process.env.NODE_ENV !== 'production') {
      const list = (results as any)?.results ?? [];
      const scores = list.map((r: any) => r?.score ?? 0);
      const confs = list.map((r: any) => r?.confidence ?? 0);
      const max = scores.length ? Math.max(...scores) : null;
      const min = scores.length ? Math.min(...scores) : null;
      const avg = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
      const cmax = confs.length ? Math.max(...confs) : null;
      const cmin = confs.length ? Math.min(...confs) : null;
      const cavg = confs.length ? confs.reduce((a: number, b: number) => a + b, 0) / confs.length : null;
      console.log('[api/search]', { strategy, q: options.query, got: list.length, min, max, avg, cmin, cmax, cavg });
    }

    return NextResponse.json({
      success: true,
      data: results,
    });

  } catch (error) {
    console.error('Search API error:', error);
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, options = {}, strategy = 'keyword' } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const searchOptions: SearchOptions = {
      query,
      limit: options.limit || 20,
      offset: options.offset || 0,
      videoIds: options.videoIds,
    };

    const searchService = SubtitleSearchService.getInstance();

    // 服务应该已在启动时初始化，直接使用

    const results = String(strategy).toLowerCase() === 'vector'
      ? await searchService.searchVectorTopK(searchOptions.query, searchOptions.limit ?? 20)
      : await searchService.search(searchOptions);

    return NextResponse.json({
      success: true,
      data: results,
    });

  } catch (error) {
    console.error('Search API error:', error);
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
