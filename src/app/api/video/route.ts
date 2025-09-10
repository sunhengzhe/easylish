import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      );
    }

    // 这里可以根据用户输入来决定返回哪个视频
    // 目前先返回固定的视频信息，后续可以扩展为更复杂的逻辑
    const videoData = getVideoByInput(input.trim());

    return NextResponse.json({
      videoId: videoData.videoId,
      startMs: videoData.startMs,
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

// 根据用户输入返回对应的视频信息
function getVideoByInput(input: string): { videoId: string; startMs: number } {
  // 这里可以实现更复杂的逻辑来匹配不同的视频
  // 比如关键词匹配、AI 分析等

  const inputLower = input.toLowerCase();

  // 示例：根据不同关键词返回不同视频
  if (inputLower.includes('学习') || inputLower.includes('教育')) {
    return {
      videoId: 'BV1B7411m7LV',
      startMs: 75000 // 75秒
    };
  } else if (inputLower.includes('音乐') || inputLower.includes('歌曲')) {
    return {
      videoId: 'BV1fK6RYZEkd',
      startMs: 30000 // 30秒
    };
  } else if (inputLower.includes('技术') || inputLower.includes('编程')) {
    return {
      videoId: 'BV1B7411m7LV',
      startMs: 120000 // 120秒
    };
  } else {
    // 默认视频
    return {
      videoId: 'BV1B7411m7LV',
      startMs: 75000
    };
  }
}
