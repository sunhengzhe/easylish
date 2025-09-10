"use client";

import { useState } from "react";

interface VideoData {
  videoId: string;
  episode?: number;
  startMs: number;
  text?: string;
  score?: number;
}

// 首页仅提供一个功能：输入台词，定位最接近的视频与时间点

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async () => {
    if (inputValue.trim().length === 0) return;

    setLoading(true);
    try {
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: inputValue.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setVideoData({
          videoId: data.videoId,
          episode: data.episode || 1,
          startMs: data.startMs,
          text: data.text,
          score: data.score,
        });
        setShowVideo(true);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'No matching content found');
      }
    } catch (error) {
      console.error('Error calling API:', error);
      alert('搜索出错，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // 页面简化后，无搜索结果列表

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900">
      {/* 主要内容区域 */}
      <div className="w-full max-w-4xl mx-auto">
        {/* 单一功能：输入台词，定位最接近的视频片段 */}

        {/* 输入框和按钮 */}
        <div className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={"输入台词内容，定位最接近的视频片段..."}
              className="flex-1 px-6 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
            />
            <button
              onClick={handleSubmit}
              disabled={inputValue.trim().length === 0 || loading}
              className="px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? '定位中...' : '定位'}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            根据输入台词定位到最匹配的视频片段并播放。
          </p>
        </div>


        {/* 视频区域 */}
        {showVideo && videoData && (
          <div className="w-full">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={`//player.bilibili.com/player.html?bvid=${videoData.videoId}&p=${videoData.episode || 1}&autoplay=1&t=${Math.floor(videoData.startMs / 1000)}&muted=0&danmaku=0`}
                className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                scrolling="no"
                frameBorder="0"
                allowFullScreen
              />
            </div>
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                视频ID: {videoData.videoId} | 集数: {videoData.episode || 1} | 开始时间: {Math.floor(videoData.startMs / 1000)}秒
              </div>
              {videoData.text && (
                <div className="text-center">
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    &ldquo;{videoData.text}&rdquo;
                  </p>
                  {videoData.score && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      匹配度: {videoData.score.toFixed(1)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
