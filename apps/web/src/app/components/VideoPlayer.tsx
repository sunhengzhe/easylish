"use client";

import React from "react";

interface VideoPlayerProps {
  videoId: string;
  episode?: number;
  startMs: number;
}

export default function VideoPlayer({ videoId, episode = 1, startMs }: VideoPlayerProps) {
  return (
    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
      <iframe
        key={`${videoId}-${startMs}`}
        src={`//player.bilibili.com/player.html?bvid=${videoId}&p=${episode}&autoplay=0&t=${Math.floor(startMs / 1000)}&muted=0&danmaku=0&high_quality=1`}
        className="absolute top-0 left-0 w-full h-full rounded-lg shadow-2xl"
        scrolling="no"
        frameBorder={0}
        allowFullScreen
      />
    </div>
  );
}

