"use client";

import React from "react";

interface ResultNavigatorProps {
  currentIndex: number; // zero-based
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}

export default function ResultNavigator({ currentIndex, total, onPrevious, onNext }: ResultNavigatorProps) {
  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-center mt-3 mb-1">
      <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-full px-3 py-1.5 backdrop-blur-sm">
        {/* Left */}
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="w-6 h-6 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all duration-200"
          aria-label="上一个结果"
        >
          <svg
            className="w-3 h-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:text-gray-300 dark:disabled:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Counter */}
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal px-1 select-none">
          {currentIndex + 1} / {total}
        </span>

        {/* Right */}
        <button
          onClick={onNext}
          disabled={currentIndex === total - 1}
          className="w-6 h-6 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:hover:bg-transparent disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all duration-200"
          aria-label="下一个结果"
        >
          <svg
            className="w-3 h-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:text-gray-300 dark:disabled:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

