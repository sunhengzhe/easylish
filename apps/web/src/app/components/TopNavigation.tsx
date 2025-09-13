import React from 'react';
import Link from 'next/link';

interface TopNavigationProps {
  currentPage?: 'home' | 'about';
  showLogo?: boolean;
  onAboutClick?: () => void;
}

export default function TopNavigation({ currentPage = 'home', showLogo = false, onAboutClick }: TopNavigationProps) {
  return (
    <nav className="w-full bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 左侧占位 */}
          <div className="flex-1">
            {/* 空白区域 */}
          </div>

          {/* 中间 Logo - 只在搜索结果页显示 */}
          <div className="flex-shrink-0">
            {showLogo && (
              <Link href="/" className="hover:opacity-80 transition-opacity duration-200">
                <img
                  src="/easylish-logo.png"
                  alt="Easylish Logo"
                  className="h-8 w-auto object-contain"
                />
              </Link>
            )}
          </div>

          {/* 右侧导航 - 只保留关于 */}
          <div className="flex-1 flex justify-end">
            <div className="flex items-center">
              <button
                onClick={onAboutClick}
                className={`text-sm font-medium transition-colors duration-200 ${
                  currentPage === 'about'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                关于
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
