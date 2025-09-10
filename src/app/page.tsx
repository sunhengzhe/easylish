"use client";

import { useState } from "react";
import Image from "next/image";

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
          const videoData = {
            videoId: data.videoId,
            episode: data.episode || 1,
            startMs: data.startMs,
            text: data.text,
            score: data.score,
          };

          // 调试信息输出到控制台
          console.log('🎯 视频定位结果:', {
            videoId: videoData.videoId,
            episode: videoData.episode,
            startTime: `${Math.floor(videoData.startMs / 1000)}秒`,
            matchedText: videoData.text,
            matchScore: videoData.score?.toFixed(2)
          });

          setVideoData(videoData);
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
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {showVideo && videoData ? (
        // 视频播放模式：视频为主体，其他元素为配角
        <div className="min-h-screen flex flex-col">
          {/* 顶部区域：Logo 在顶部中央 */}
          <div className="flex justify-center p-4 sm:p-6">
            <Image
              src="/easylish-logo.png"
              alt="Easylish Logo"
              width={120}
              height={48}
              className="object-contain"
              priority
            />
          </div>

          {/* 主要视频区域：占据中央位置 */}
          <div className="flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 py-6">
            <div className="w-full max-w-5xl">
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`//player.bilibili.com/player.html?bvid=${videoData.videoId}&p=${videoData.episode || 1}&autoplay=1&t=${Math.floor(videoData.startMs / 1000)}&muted=0&danmaku=0`}
                  className="absolute top-0 left-0 w-full h-full rounded-lg shadow-2xl"
                  scrolling="no"
                  frameBorder="0"
                  allowFullScreen
                />
              </div>
              {videoData.text && (
                <div className="mt-6 text-center">
                  <p className="text-gray-900 dark:text-gray-100 font-medium text-lg sm:text-xl">
                    &ldquo;{videoData.text}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 底部输入区域：紧凑设计 */}
          <div className="px-4 sm:px-6 md:px-8 pb-6">
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="继续输入台词定位其他片段..."
                  className="flex-1 px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
                />
                <button
                  onClick={handleSubmit}
                  disabled={inputValue.trim().length === 0 || loading}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                >
                  {loading ? '查询中...' : '查询'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // 初始状态：居中的搜索界面
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="w-full max-w-2xl mx-auto text-center">
            {/* Logo */}
            <div className="mb-12">
              <Image
                src="/easylish-logo.png"
                alt="Easylish Logo"
                width={300}
                height={120}
                className="object-contain mx-auto"
                priority
              />
            </div>

            {/* 输入框和按钮 */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="输入台词内容，看看英文怎么说..."
                  className="flex-1 px-6 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
                />
                <button
                  onClick={handleSubmit}
                  disabled={inputValue.trim().length === 0 || loading}
                  className="px-8 py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap text-lg"
                >
                  {loading ? '查询中...' : '查询'}
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                根据输入台词查询到最匹配的地道英文
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
