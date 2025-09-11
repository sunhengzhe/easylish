#!/bin/bash
set -e

# CloudBase CLI 部署脚本
echo "🚀 使用 CloudBase CLI 部署 easylish..."

# 检查 CLI 是否安装
if ! command -v tcb &> /dev/null; then
    echo "📦 安装 CloudBase CLI..."
    npm install -g @cloudbase/cli
fi

# 检查是否已登录
echo "🔐 检查登录状态..."
if ! tcb auth list &> /dev/null; then
    echo "请先登录 CloudBase:"
    tcb login
fi

# 部署云托管服务
echo "☁️ 部署到云托管..."
tcb deploy cloudrun

echo "✅ 部署完成！"
echo "🌐 请查看云托管控制台获取访问地址"

