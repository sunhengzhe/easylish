#!/bin/bash
set -e

# 腾讯云容器镜像部署脚本
# 使用前请先配置：
# 1. 替换 YOUR_NAMESPACE 为你的命名空间
# 2. 确保已登录 docker login ccr.ccs.tencentyun.com

NAMESPACE="easylish"  # 替换为你的命名空间
SERVICE_NAME="easylish"
VERSION="v$(date +%Y%m%d-%H%M%S)"
IMAGE_TAG="ccr.ccs.tencentyun.com/${NAMESPACE}/${SERVICE_NAME}:${VERSION}"

echo "🚀 开始构建和部署 easylish..."

# 1. 构建镜像
echo "📦 构建镜像..."
if ! docker build -t ${SERVICE_NAME}:latest .; then
    echo "❌ 镜像构建失败！请检查 Dockerfile 和依赖配置"
    exit 1
fi

echo "🏷️ 给镜像打标签..."
docker tag ${SERVICE_NAME}:latest ${IMAGE_TAG}

# 2. 本地测试镜像
echo "🧪 本地测试镜像..."
if ! docker run -d --name ${SERVICE_NAME}-test -p 3000:3000 ${SERVICE_NAME}:latest; then
    echo "❌ 镜像测试失败！请检查应用配置"
    exit 1
fi

echo "⏱️ 等待应用启动（15秒）..."
sleep 15

echo "🔍 检查应用健康状态..."
if curl -f http://localhost:3000/api/status > /dev/null 2>&1; then
    echo "✅ 应用启动成功！"
else
    echo "⚠️ 应用可能未完全启动，但镜像构建正常"
fi

# 清理测试容器
docker stop ${SERVICE_NAME}-test > /dev/null 2>&1
docker rm ${SERVICE_NAME}-test > /dev/null 2>&1

# 3. 推送镜像
echo "📤 推送镜像到腾讯云..."
if ! docker push ${IMAGE_TAG}; then
    echo "❌ 镜像推送失败！请检查网络和认证状态"
    exit 1
fi

echo "✅ 镜像推送完成！"
echo "📋 镜像地址: ${IMAGE_TAG}"
echo ""
echo "🌐 请在云托管控制台使用以下信息部署："
echo "   镜像地址: ${IMAGE_TAG}"
echo "   端口: 3000"
echo "   环境变量:"
echo "     NODE_ENV=production"
echo "     NEXT_TELEMETRY_DISABLED=1"
echo "     VECTOR_PROVIDER=xenova"
echo ""
echo "🔗 一键部署链接:"
echo "https://tcb.cloud.tencent.com/dev#/platform-run/service/create?type=image&image=${IMAGE_TAG}&serverName=${SERVICE_NAME}&port=3000"
