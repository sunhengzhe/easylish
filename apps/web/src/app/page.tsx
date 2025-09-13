"use client";

import { useState, useEffect, useCallback } from "react";
import type { SearchResult as ApiSearchResult } from "@/lib/types/subtitle";
import VideoPlayer from "./components/VideoPlayer";
import ResultNavigator from "./components/ResultNavigator";
import SearchInput from "./components/SearchInput";
import TopNavigation from "./components/TopNavigation";
import AboutModal from "./components/AboutModal";
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
  "Guess how much I love you",
  "重要的东西用眼睛是看不见的",
  "The 24 solar terms",
  "相信美好的事情即将发生",
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
  const [showAboutModal, setShowAboutModal] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setMounted(true);

    // 监听 popstate 事件（浏览器前进后退）
    const handlePopState = () => {
      // 如果用户点击浏览器后退按钮，清除搜索状态
      if (showVideo && window.location.pathname === '/') {
        setShowVideo(false);
        setVideoData(null);
        setSearchResults([]);
        setCurrentIndex(0);
        setInputValue("");
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showVideo]);

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

  const handleAboutClick = () => {
    setShowAboutModal(true);
  };

  const handleAboutClose = () => {
    setShowAboutModal(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleClearInput = () => {
    setInputValue("");
  };

  const handleRandomSubtitle = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/random');

      if (response.ok) {
        const data = await response.json();
        const result = data.data.result as ApiSearchResult;

        // 设置搜索结果（只有一条随机结果）
        setSearchResults([result]);
        setCurrentIndex(0);

        // 设置视频数据
        const videoData = {
          videoId: result.entry.videoId,
          episode: result.entry.episodeNumber || 1,
          startMs: result.entry.startTime,
          text: result.entry.text,
          score: result.score,
          confidence: undefined,
        };

        console.log('🎲 随机台词:', {
          videoId: videoData.videoId,
          startTime: `${Math.floor(videoData.startMs / 1000)}秒`,
          text: videoData.text,
          score: videoData.score?.toFixed(2),
        });

        setVideoData(videoData);
        setShowVideo(true);
        setInputValue(''); // 清空输入框，因为这是随机结果

        // 添加历史记录
        window.history.pushState({ search: true }, '', window.location.pathname);
      } else {
        showToast({
          type: 'warning',
          message: '获取随机台词失败，稍后再试试～',
        });
      }
    } catch (error) {
      console.error('Error fetching random subtitle:', error);
      showToast({
        type: 'error',
        message: '随机台词功能遇到问题，请稍后再试',
      });
    } finally {
      setLoading(false);
    }
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

          // 添加历史记录，支持浏览器后退
          window.history.pushState({ search: true }, '', window.location.pathname);
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
      <TopNavigation currentPage="home" showLogo={showVideo} onAboutClick={handleAboutClick} />

      {showVideo && videoData ? (
        // 视频播放模式
        <div className="min-h-[calc(100vh-4rem)] flex flex-col">{/* 减去导航栏高度 */}

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
                onRandomSubmit={handleRandomSubtitle}
                onClear={handleClearInput}
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
        <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">{/* 减去导航栏高度 */}
          <div className="w-full max-w-2xl mx-auto text-center">
            {/* Logo - 在首页状态下显示大尺寸 */}
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
                onRandomSubmit={handleRandomSubtitle}
                onClear={handleClearInput}
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

      {/* About Modal */}
      <AboutModal isOpen={showAboutModal} onClose={handleAboutClose} />
    </div>
  );
}
