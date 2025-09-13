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
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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
                  <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    视频来源：Bilibili，如有侵权，请及时联系。
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
                        className="w-60 h-60 md:w-56 md:h-56 object-contain"
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
