"use client";

import { useState, useEffect } from "react";
import type { SearchResult as ApiSearchResult } from "@/lib/types/subtitle";
import VideoPlayer from "./components/VideoPlayer";
import ResultNavigator from "./components/ResultNavigator";
import SuggestionScroller from "./components/SuggestionScroller";

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
  "一会吃什么？",
  "今天天气真好",
  "你好吗？",
  "谢谢你的帮助",
  "不好意思，我迟到了",
  "这个多少钱？",
  "我饿了",
  "时间过得真快",
  "你在做什么？",
  "晚安",
  "祝你好运",
  "没关系",
  "太棒了！",
  "我觉得很有趣",
  "你觉得怎么样？"
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

  useEffect(() => {
    setMounted(true);
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


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async () => {
    // 如果用户没有输入内容，使用当前显示的提示词（处理循环边界）
    const idx = suggestionIndex % suggestions.length;
    const queryText = inputValue.trim() || suggestions[idx];

    setLoading(true);
    try {
      // 获取多个搜索结果
      const response = await fetch(`/api/search?q=${encodeURIComponent(queryText)}&limit=10&strategy=vector`);

      if (response.ok) {
        const data = await response.json();
        const results = data.data.results as ApiSearchResult[];

        // 过滤高置信度结果（优先使用归一化置信度），对极短文本加更严格门槛
        const maxScore = results.length > 0 ? Math.max(...results.map(r => r.score)) : 0;
        const baseThreshold = Number(process.env.NEXT_PUBLIC_MIN_CONFIDENCE || 0.65);
        const highQualityResults = results.filter(result => {
          const text = (result.entry.text || '').toLowerCase();
          const cleanLen = text.replace(/[^\p{L}\p{N}]+/gu, '').length;
          const isVeryShort = cleanLen <= 3; // 如 "ok", "bye", "yay"
          if (typeof result.confidence === 'number') {
            const thr = isVeryShort ? Math.max(baseThreshold, 0.85) : baseThreshold;
            return result.confidence >= thr;
          }
          // 关键词检索回退：按相对阈值
          const rel = maxScore > 0 ? (result.score / maxScore) : 1;
          const thrRel = isVeryShort ? 0.95 : 0.6;
          return rel >= thrRel;
        });

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
            confidence: firstResult.confidence,
          };

          // 调试信息输出到控制台
          console.log('🎯 搜索结果:', {
            totalResults: highQualityResults.length,
            currentIndex: 1,
            videoId: videoData.videoId,
            startTime: `${Math.floor(videoData.startMs / 1000)}秒`,
            matchedText: videoData.text,
            matchScore: videoData.score?.toFixed(2),
            confidence: (firstResult.confidence ?? 0).toFixed(2)
          });

          setVideoData(videoData);
          setShowVideo(true);
        } else {
          alert('未找到高质量的匹配结果');
        }
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
      confidence: result.confidence,
    };

    console.log('🎯 切换结果:', {
      currentIndex: index + 1,
      totalResults: searchResults.length,
      videoId: videoData.videoId,
      startTime: `${Math.floor(videoData.startMs / 1000)}秒`,
      matchedText: videoData.text,
      matchScore: videoData.score?.toFixed(2),
      confidence: (result.confidence ?? 0).toFixed(2)
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
          {/* 顶部区域：Logo */}
          <div className="flex justify-center pt-6 pb-4">
            <img
              src="/easylish-logo.png"
              alt="Easylish Logo"
              width={200}
              height={80}
              className="object-contain"
              style={{ width: 'auto', height: 'auto', maxWidth: '200px', maxHeight: '80px' }}
            />
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
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                  placeholder="继续输入台词定位其他片段..."
                  className="flex-1 px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-300 focus:border-orange-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:ring-offset-1 whitespace-nowrap text-base"
                >
                  {loading ? '查找中...' : '查一查'}
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
                在英文视频中学习地道的英文表达!
              </p>
            </div>

            {/* 输入框和按钮 */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-300 focus:border-orange-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all duration-200 disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {!inputValue && (
                    <SuggestionScroller
                      suggestions={suggestions}
                      suggestionIndex={suggestionIndex}
                      isResetting={isResetting}
                    />
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:ring-offset-1 whitespace-nowrap text-base"
                >
                  {loading ? '查找中...' : '查一查'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
