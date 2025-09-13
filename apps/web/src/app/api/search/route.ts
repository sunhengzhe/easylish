import { NextRequest, NextResponse } from 'next/server';
import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';
import { SearchOptions, SearchResponse, SearchResult } from '@/lib/types/subtitle';

export const runtime = 'nodejs';

/**
 * 对搜索结果按视频去重，保留每个视频中分数最高的一条记录
 */
function deduplicateByVideo(results: SearchResult[]): SearchResult[] {
  const videoMap = new Map<string, SearchResult>();

  for (const result of results) {
    const videoId = result.entry.videoId;
    const existingResult = videoMap.get(videoId);

    // 如果该视频还没有记录，或者当前结果分数更高，则更新
    if (!existingResult || result.score > existingResult.score) {
      videoMap.set(videoId, result);
    }
  }

  // 返回去重后的结果，按原始分数排序
  return Array.from(videoMap.values()).sort((a, b) => b.score - a.score);
}

/**
 * 过滤掉 normalizedText 中只有单个词的搜索结果
 */
function filterShortWords(results: SearchResult[]): SearchResult[] {
  return results.filter(result => {
    const normalizedText = result.entry.normalizedText || '';

    // 移除标点符号和多余空格，然后按空格分割
    const words = normalizedText
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ') // 保留字母、数字、空格和中文字符
      .replace(/\s+/g, ' ') // 将多个空格合并为一个
      .trim()
      .split(' ')
      .filter(word => word.length > 0); // 移除空字符串

    // 只保留有多个词的结果
    return words.length > 2;
  });
}

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

    // 执行向量搜索（获取更多结果以便去重后仍有足够数据）
    const searchService = SubtitleSearchService.getInstance();
    const searchLimit = Math.max((options.limit ?? 20) * 3, 50); // 获取3倍数量确保去重后有足够结果
    const rawResults = await searchService.searchVectorTopK(options.query, searchLimit);

    // 过滤掉只有单个词的结果
    const filteredResults = filterShortWords(rawResults.results);

    // 对结果按视频去重
    const deduplicatedResults = deduplicateByVideo(filteredResults);

    // 应用原始的 limit 限制
    const finalResults = deduplicatedResults.slice(0, options.limit ?? 20);

    const results: SearchResponse = {
      results: finalResults,
      total: finalResults.length,
      query: rawResults.query,
    };

    if (process.env.NODE_ENV !== 'production') {
      const scores = finalResults.map((r) => r?.score ?? 0);
      const max = scores.length ? Math.max(...scores) : null;
      const min = scores.length ? Math.min(...scores) : null;
      const avg = scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;
      console.log('[api/search]', {
        q: options.query,
        rawCount: rawResults.results.length,
        filteredCount: filteredResults.length,
        dedupCount: deduplicatedResults.length,
        finalCount: finalResults.length,
        min, max, avg
      });
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

    // 执行向量搜索（获取更多结果以便去重后仍有足够数据）
    const searchLimit = Math.max((searchOptions.limit ?? 20) * 3, 50);
    const rawResults = await searchService.searchVectorTopK(searchOptions.query, searchLimit);

    // 过滤掉只有单个词的结果
    const filteredResults = filterShortWords(rawResults.results);

    // 对结果按视频去重
    const deduplicatedResults = deduplicateByVideo(filteredResults);

    // 应用原始的 limit 限制
    const finalResults = deduplicatedResults.slice(0, searchOptions.limit ?? 20);

    const results: SearchResponse = {
      results: finalResults,
      total: finalResults.length,
      query: rawResults.query,
    };

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
