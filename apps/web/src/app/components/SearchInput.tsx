import React from 'react';
import SuggestionScroller from './SuggestionScroller';

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onRandomSubmit?: () => void;
  onClear?: () => void;
  loading: boolean;
  placeholder: string;
  suggestions: string[];
  suggestionIndex: number;
  isResetting: boolean;
  showSuggestions?: boolean;
  className?: string;
}

export default function SearchInput({
  value,
  onChange,
  onKeyPress,
  onSubmit,
  onRandomSubmit,
  onClear,
  loading,
  placeholder,
  suggestions,
  suggestionIndex,
  isResetting,
  showSuggestions = true,
  className = "",
}: SearchInputProps) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      <div className="flex-1 relative">
        <input
          type="text"
          value={value}
          onChange={onChange}
          onKeyPress={onKeyPress}
          disabled={loading}
          placeholder={placeholder}
          className={`w-full py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-300 focus:border-orange-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${
            value && onClear ? 'pl-4 pr-10' : 'px-4'
          }`}
        />

        {/* 清空按钮 - 只在有输入时显示 */}
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="清空输入"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 4.586L9.293 1.293a1 1 0 111.414 1.414L7.414 6l3.293 3.293a1 1 0 01-1.414 1.414L6 7.414l-3.293 3.293a1 1 0 01-1.414-1.414L4.586 6 1.293 2.707a1 1 0 011.414-1.414L6 4.586z"/>
            </svg>
          </button>
        )}

        {showSuggestions && !value && (
          <SuggestionScroller
            suggestions={suggestions}
            suggestionIndex={suggestionIndex}
            isResetting={isResetting}
          />
        )}
      </div>
      <div className="flex gap-2">
        {onRandomSubmit && (
          <button
            onClick={onRandomSubmit}
            disabled={loading}
            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:ring-offset-1 text-base"
            title="随机台词"
          >
            🎲
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:ring-offset-1 whitespace-nowrap text-base"
        >
          {loading ? '查找中...' : '查一查'}
        </button>
      </div>
    </div>
  );
}
