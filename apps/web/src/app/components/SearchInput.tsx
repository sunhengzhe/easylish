import React from 'react';
import SuggestionScroller from './SuggestionScroller';

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
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
          className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-300 focus:border-orange-300 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all duration-200 disabled:bg-slate-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {showSuggestions && !value && (
          <SuggestionScroller
            suggestions={suggestions}
            suggestionIndex={suggestionIndex}
            isResetting={isResetting}
          />
        )}
      </div>
      <button
        onClick={onSubmit}
        disabled={loading}
        className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-orange-400 focus:ring-offset-1 whitespace-nowrap text-base"
      >
        {loading ? '查找中...' : '查一查'}
      </button>
    </div>
  );
}
