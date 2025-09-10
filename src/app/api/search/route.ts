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

    // 执行搜索
    const searchService = SubtitleSearchService.getInstance();

    // 确保服务已初始化
    if (!searchService.isReady()) {
      await searchService.initialize();
    }

    const results = await searchService.search(options);

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
    const { query, options = {} } = body;

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

    // 确保服务已初始化
    if (!searchService.isReady()) {
      await searchService.initialize();
    }

    const results = await searchService.search(searchOptions);

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
