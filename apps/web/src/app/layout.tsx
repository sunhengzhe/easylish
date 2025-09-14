import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "./components/Toast";

export const metadata: Metadata = {
  title: "Easylish - 简单学英语",
  description: "在英文视频中学习地道的英文表达 ✨",
  keywords: ["英语学习", "英语视频", "英语台词", "英语表达", "学英语"],
  authors: [{ name: "Easylish" }],

  // Open Graph 标签（用于社交媒体分享，包括微信）
  openGraph: {
    title: "Easylish - 简单学英语",
    description: "在英文视频中学习地道的英文表达 ✨",
    url: "https://sunhz.cn", // 替换为你的实际域名
    siteName: "Easylish",
    images: [
      {
        url: "/share.jpeg",
        width: 1200,
        height: 630,
        alt: "Easylish - 简单学英语",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },

  // Twitter Card 标签
  twitter: {
    card: "summary_large_image",
    title: "Easylish - 简单学英语",
    description: "在英文视频中学习地道的英文表达 ✨",
    images: ["/share.jpeg"],
  },

  // 其他 meta 标签
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 微信分享相关的额外 meta 标签 */}
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:secure_url" content="/share.jpeg" />

        {/* 微信小程序兼容 */}
        <meta name="format-detection" content="telephone=no" />

        {/* 移动端优化 */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body className="antialiased">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
