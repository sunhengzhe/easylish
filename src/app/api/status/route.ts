import { NextRequest, NextResponse } from 'next/server';
import { SubtitleSearchService } from '@/lib/services/subtitle-search-service';
import { AppInitializer } from '@/lib/init/startup';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  try {
    const searchService = SubtitleSearchService.getInstance();

    // 获取应用状态
    const appStatus = AppInitializer.getStatus();

    // 获取服务统计信息
    let stats = null;
    if (searchService.isReady()) {
      stats = await searchService.getStats();
    }

    return NextResponse.json({
      success: true,
      data: {
        status: appStatus,
        stats,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Status API error:', error);
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
