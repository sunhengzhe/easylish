"use client";

import { useState, useEffect, useCallback } from "react";
import type { SearchResult as ApiSearchResult } from "@/lib/types/subtitle";
import VideoPlayer from "./components/VideoPlayer";
import ResultNavigator from "./components/ResultNavigator";
import SearchInput from "./components/SearchInput";
import { useToast } from "./components/Toast";

interface VideoData {
  videoId: string;
  episode?: number;
  startMs: number;
  text?: string;
  score?: number;
  confidence?: number;
}

// 首页仅提供一个功能：输入台词，定位最接近的视频与时间点

// 日常生活中常见的中文表达
const suggestions = [
  "求知若饥，虚心若愚",
  "相信美好的事情即将发生",
  "对的时间，对的地点",
  "The 24 solar terms",
  "Guess how much I love you",
  "小鸭子去游泳",
  "小猪佩奇"
];

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [searchResults, setSearchResults] = useState<ApiSearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setMounted(true);

    // 监听 hash 变化
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '' || hash === '#') {
        // 返回首页状态
        setShowVideo(false);
        setVideoData(null);
        setSearchResults([]);
        setCurrentIndex(0);
        setInputValue("");
      }
    };

    // 初始化时检查 hash
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 循环切换提示词
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIndex((prevIndex) => prevIndex + 1);
    }, 3500); // 每3.5秒切换一次

    return () => clearInterval(interval);
  }, []);

  // 处理无缝循环
  useEffect(() => {
    if (suggestionIndex === suggestions.length) {
      // 当切换到复制的第一个元素后，立即无动画跳回真正的第一个
      const timer = setTimeout(() => {
        setIsResetting(true);
        setSuggestionIndex(0);
        // 立即重置状态
        setTimeout(() => setIsResetting(false), 50);
      }, 700); // 等待动画完成

      return () => clearTimeout(timer);
    }
  }, [suggestionIndex]);


  // 返回首页
  const goToHome = useCallback(() => {
    window.location.hash = '';
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async () => {
    // 如果用户没有输入内容，使用当前显示的提示词（处理循环边界）
    const idx = suggestionIndex % suggestions.length;
    const trimmed = inputValue.trim();
    const fallback = suggestions[idx];
    const queryText = trimmed || fallback;
    // 若使用了推荐关键词，自动填充到输入框，提升可见性与可控性
    if (!trimmed) {
      setInputValue(queryText);
    }

    setLoading(true);
    try {
      // 获取多个搜索结果
      const response = await fetch(`/api/search?q=${encodeURIComponent(queryText)}&limit=10`);

      if (response.ok) {
        const data = await response.json();
        const results = data.data.results as ApiSearchResult[];

        // 过滤结果：基于分数的简单阈值，不再使用 confidence
        // Only show items with score >= threshold (default 0.7)
        const baseScore = Number(process.env.NEXT_PUBLIC_MIN_SCORE || 0.7);
        const highQualityResults = results.filter(r => (r.score ?? 0) >= baseScore);

        if (highQualityResults.length > 0) {
          setSearchResults(highQualityResults);
          setCurrentIndex(0);

          // 设置第一个结果为当前视频
          const firstResult = highQualityResults[0];
          const videoData = {
            videoId: firstResult.entry.videoId,
            episode: firstResult.entry.episodeNumber || 1,
            startMs: firstResult.entry.startTime,
            text: firstResult.entry.text,
            score: firstResult.score,
            confidence: undefined,
          };

          // 调试信息输出到控制台
          console.log('🎯 搜索结果:', {
            totalResults: highQualityResults.length,
            currentIndex: 1,
            videoId: videoData.videoId,
            startTime: `${Math.floor(videoData.startMs / 1000)}秒`,
            matchedText: videoData.text,
            matchScore: videoData.score?.toFixed(2),
            confidence: undefined
          });

          setVideoData(videoData);
          setShowVideo(true);

          // 设置 hash 表示进入搜索结果状态
          window.location.hash = 'search';
        } else {
          showToast({
            type: 'info',
            message: '这句暂时没匹配到合适片段，换个说法再试试？',
          });
        }
      } else {
        // 服务返回非 2xx
        showToast({
          type: 'warning',
          message: '服务有点忙，稍后再试试～',
        });
      }
    } catch (error) {
      console.error('Error calling API:', error);
      showToast({
        type: 'error',
        message: '搜索遇到点小问题，请稍后再试',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      updateVideoFromResult(newIndex);
    }
  };

  const handleNext = () => {
    if (currentIndex < searchResults.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      updateVideoFromResult(newIndex);
    }
  };

  const updateVideoFromResult = (index: number) => {
    const result = searchResults[index];
    const videoData = {
      videoId: result.entry.videoId,
      episode: result.entry.episodeNumber || 1,
      startMs: result.entry.startTime,
      text: result.entry.text,
      score: result.score,
      confidence: undefined,
    };

    console.log('🎯 切换结果:', {
      currentIndex: index + 1,
      totalResults: searchResults.length,
      videoId: videoData.videoId,
      startTime: `${Math.floor(videoData.startMs / 1000)}秒`,
      matchedText: videoData.text,
      matchScore: videoData.score?.toFixed(2),
      confidence: undefined
    });

    setVideoData(videoData);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };


  // 防止hydration不匹配，确保客户端渲染一致性
  if (!mounted) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {showVideo && videoData ? (
        // 视频播放模式：平衡布局，logo明显可见
        <div className="min-h-screen flex flex-col">
          {/* 顶部区域：Logo 和返回按钮 */}
          <div className="flex justify-between items-center pt-6 pb-4 px-4 sm:px-6 md:px-8">
            <button
              onClick={goToHome}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm">返回</span>
            </button>

            <img
              src="/easylish-logo.png"
              alt="Easylish Logo"
              width={200}
              height={80}
              className="object-contain"
              style={{ width: 'auto', height: 'auto', maxWidth: '200px', maxHeight: '80px' }}
            />

            <div className="w-16"></div> {/* 占位符保持居中 */}
          </div>

          {/* 主要视频区域：适中尺寸，不占满屏幕 */}
          <div className="flex-1 flex items-start justify-center px-4 sm:px-6 md:px-8 pt-4 pb-8">
            <div className="w-full max-w-3xl">
              {/* 视频播放器 - 保持全宽度 */}
              {videoData && (
                <VideoPlayer videoId={videoData.videoId} episode={videoData.episode} startMs={videoData.startMs} />
              )}

              {/* 独立的导航控制组件 */}
              <ResultNavigator
                currentIndex={currentIndex}
                total={searchResults.length}
                onPrevious={handlePrevious}
                onNext={handleNext}
              />

              {/* 台词文本 */}
              {videoData.text && (
                <div className="mt-4 text-center">
                  <p className="text-gray-900 dark:text-gray-100 font-medium text-lg sm:text-xl">
                    &ldquo;{videoData.text}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 底部输入区域：优化间距 */}
          <div className="px-4 sm:px-6 md:px-8 pb-8">
            <div className="max-w-3xl mx-auto">
              <SearchInput
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onSubmit={handleSubmit}
                loading={loading}
                placeholder=""
                suggestions={suggestions}
                suggestionIndex={suggestionIndex}
                isResetting={isResetting}
                showSuggestions={true}
              />
            </div>
          </div>
        </div>
      ) : (
        // 初始状态：居中的搜索界面
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
          <div className="w-full max-w-2xl mx-auto text-center">
            {/* Logo */}
            <div className="mb-2">
              <img
                src="/easylish-logo.png"
                alt="Easylish Logo"
                width={300}
                height={120}
                className="object-contain mx-auto"
                style={{ width: 'auto', height: 'auto', maxWidth: '300px', maxHeight: '120px' }}
              />
            </div>

            {/* Slogan */}
            <div className="mb-10">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                在英文视频中学习地道的英文表达 ✨
              </p>
            </div>

            {/* 输入框和按钮 */}
            <div className="mb-6">
              <SearchInput
                value={inputValue}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                onSubmit={handleSubmit}
                loading={loading}
                placeholder=""
                suggestions={suggestions}
                suggestionIndex={suggestionIndex}
                isResetting={isResetting}
                showSuggestions={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
