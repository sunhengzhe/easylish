"use client";

import { useState } from "react";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [showVideo, setShowVideo] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = () => {
    if (inputValue.trim().length > 0) {
      setShowVideo(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900">
      {/* 主要内容区域 */}
      <div className="w-full max-w-2xl mx-auto">
        {/* 输入框和按钮 */}
        <div className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="请输入任意内容..."
              className="flex-1 px-6 py-4 text-lg border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200"
            />
            <button
              onClick={handleSubmit}
              disabled={inputValue.trim().length === 0}
              className="px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              确定
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            输入内容后点击确定或按回车键查看视频
          </p>
        </div>

        {/* 视频区域 */}
        {showVideo && (
          <div className="w-full">
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src="//player.bilibili.com/player.html?bvid=BV1B7411m7LV&autoplay=1&t=75&muted=0&danmaku=0"
                className="absolute top-0 left-0 w-full h-full rounded-lg shadow-lg"
                scrolling="no"
                frameBorder="0"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
