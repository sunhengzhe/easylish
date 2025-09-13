'use client';

import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  // 处理点击背景关闭
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 处理 ESC 键关闭
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full h-full bg-white dark:bg-gray-900 flex flex-col">
        {/* 关闭按钮 - 右上角 */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors duration-200"
            aria-label="关闭"
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 flex items-center justify-center p-8 md:p-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="prose prose-lg md:prose-xl max-w-none text-gray-600 dark:text-gray-300 space-y-8">
              {/* 关于 Easylish */}
              <div className="text-center space-y-6">
                <div className="space-y-4">
                  <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                    关于
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto flex items-center justify-center">
                    视频来源：
                    <a
                      href="https://www.bilibili.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-pink-500 hover:text-pink-600 dark:text-pink-400 dark:hover:text-pink-300 transition-colors duration-200 hover:underline"
                    >
                      <svg viewBox='0 0 24 24' width='1.2em' height='1.2em' xmlns='http://www.w3.org/2000/svg'>
                        <path fill='currentColor' d='M7.172 2.757L10.414 6h3.171l3.243-3.242a1 1 0 1 1 1.415 1.415L16.414 6H18.5A3.5 3.5 0 0 1 22 9.5v8a3.5 3.5 0 0 1-3.5 3.5h-13A3.5 3.5 0 0 1 2 17.5v-8A3.5 3.5 0 0 1 5.5 6h2.085L5.757 4.171a1 1 0 0 1 1.415-1.415M18.5 8h-13a1.5 1.5 0 0 0-1.493 1.356L4 9.5v8a1.5 1.5 0 0 0 1.356 1.493L5.5 19h13a1.5 1.5 0 0 0 1.493-1.355L20 17.5v-8A1.5 1.5 0 0 0 18.5 8M8 11a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1m8 0a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1'/>
                      </svg>
                      Bilibili
                    </a>
                  </p>
                </div>

                {/* 联系我 */}
                <div className="space-y-4 pt-8">
                  <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                    联系我
                  </h2>

                  {/* 微信二维码 */}
                  <div className="flex justify-center">
                      <img
                        src="/wechat.jpg"
                        alt="微信二维码"
                        className="w-60 md:w-56 md:h-56 object-contain"
                      />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
