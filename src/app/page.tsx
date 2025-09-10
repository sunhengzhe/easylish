"use client";

import { useState } from "react";

interface VideoData {
  videoId: string;
  startMs: number;
  text?: string;
  score?: number;
}

interface SearchResult {
  entry: {
    id: string;
    videoId: string;
    sequenceNumber: number;
    startTime: number;
    endTime: number;
    text: string;
    normalizedText: string;
    duration: number;
  };
  score: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'video' | 'search'>('video');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleVideoSubmit = async () => {
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
          startMs: data.startMs,
          text: data.text,
          score: data.score,
        });
        setShowVideo(true);
        setSearchResults([]);
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

  const handleSearch = async () => {
    if (inputValue.trim().length === 0) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(inputValue.trim())}&limit=10`);

      if (response.ok) {
        const data = await response.json();
        const searchResponse: SearchResponse = data.data;
        setSearchResults(searchResponse.results);
        setShowVideo(false);
      } else {
        console.error('Search request failed');
        alert('搜索失败，请稍后重试');
      }
    } catch (error) {
      console.error('Error calling search API:', error);
      alert('搜索出错，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (searchMode === 'video') {
      handleVideoSubmit();
    } else {
      handleSearch();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setVideoData({
      videoId: result.entry.videoId,
      startMs: result.entry.startTime,
      text: result.entry.text,
      score: result.score,
    });
    setShowVideo(true);
    setSearchResults([]);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900">
      {/* 主要内容区域 */}
      <div className="w-full max-w-4xl mx-auto">
        {/* 模式切换 */}
        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 bg-gray-100 dark:bg-gray-800">
            <button
              onClick={() => setSearchMode('video')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                searchMode === 'video'
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              智能播放
            </button>
            <button
              onClick={() => setSearchMode('search')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                searchMode === 'search'
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              台词搜索
            </button>
          </div>
        </div>

        {/* 输入框和按钮 */}
        <div className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={
                searchMode === 'video'
                  ? "输入任意内容，找到最相关的视频片段..."
                  : "搜索台词内容..."
              }
              className="flex-1 px-6 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
            />
            <button
              onClick={handleSubmit}
              disabled={inputValue.trim().length === 0 || loading}
              className="px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? '搜索中...' : (searchMode === 'video' ? '播放' : '搜索')}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {searchMode === 'video'
              ? "智能播放模式：根据输入内容找到最匹配的视频片段并播放"
              : "台词搜索模式：搜索所有相关的台词，点击结果播放对应片段"
            }
          </p>
        </div>

        {/* 搜索结果区域 */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              搜索结果 ({searchResults.length} 条)
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={result.entry.id}
                  onClick={() => handleResultClick(result)}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      {result.entry.videoId}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.floor(result.entry.startTime / 1000)}s - {Math.floor(result.entry.endTime / 1000)}s
                    </span>
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 mb-2">
                    {result.entry.text}
                  </p>
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>相关性: {result.score.toFixed(1)}</span>
                    <span>点击播放此片段</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 视频区域 */}
        {showVideo && videoData && (
          <div className="w-full">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={`//player.bilibili.com/player.html?bvid=${videoData.videoId}&autoplay=1&t=${Math.floor(videoData.startMs / 1000)}&muted=0&danmaku=0`}
                className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                scrolling="no"
                frameBorder="0"
                allowFullScreen
              />
            </div>
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                视频ID: {videoData.videoId} | 开始时间: {Math.floor(videoData.startMs / 1000)}秒
              </div>
              {videoData.text && (
                <div className="text-center">
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    "{videoData.text}"
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
