"use client";

import React from "react";

interface SuggestionScrollerProps {
  suggestions: string[];
  suggestionIndex: number;
  isResetting?: boolean;
  lineHeightRem?: number; // viewport height in rem for a single line
}

export default function SuggestionScroller({
  suggestions,
  suggestionIndex,
  isResetting = false,
  lineHeightRem = 1.5,
}: SuggestionScrollerProps) {
  const total = suggestions.length + 1; // include duplicated first for seamless loop

  return (
    <div className="absolute inset-y-0 left-4 right-4 pointer-events-none flex items-center">
      {/* Viewport: single line, vertically centered */}
      <div className="w-full overflow-hidden" style={{ height: `${lineHeightRem}rem` }}>
        <div
          className="flex flex-col w-full"
          style={{
            transform: `translateY(-${suggestionIndex * (100 / total)}%)`,
            height: `${total * 100}%`,
            transition: isResetting ? "none" : "transform 700ms cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
          {suggestions.map((text, idx) => (
            <div
              key={idx}
              className="flex items-center text-slate-400 dark:text-slate-500 flex-shrink-0 text-base"
              style={{ height: `${100 / total}%` }}
            >
              {text}
            </div>
          ))}
          {/* duplicate the first item for seamless looping */}
          <div
            className="flex items-center text-slate-400 dark:text-slate-500 flex-shrink-0 text-base"
            style={{ height: `${100 / total}%` }}
          >
            {suggestions[0]}
          </div>
        </div>
      </div>
    </div>
  );
}

