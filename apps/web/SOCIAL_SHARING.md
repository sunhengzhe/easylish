# 社交媒体分享配置指南

## 已配置的分享信息

### 基本信息

- **标题**: Easylish - 简单学英语
- **描述**: 在英文视频中学习地道的英文表达 ✨
- **分享图片**: `/public/share.jpeg`

### Open Graph 配置

已在 `layout.tsx` 中配置完整的 Open Graph 标签，支持：

- 微信分享
- QQ 分享
- 微博分享
- Facebook、Twitter 等国外社交平台

## 微信分享测试

### 1. 本地测试

由于微信需要通过公网域名访问，本地测试需要：

```bash
# 使用 ngrok 等工具将本地端口暴露到公网
ngrok http 3000
```

### 2. 生产环境测试

1. 部署到服务器后，在微信中打开网站链接
2. 点击右上角分享按钮
3. 检查分享预览是否显示正确的标题、描述和图片

### 3. 在线验证工具

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## 分享图片最佳实践

### 推荐尺寸

- **1200×630 像素** (1.91:1 比例) - 已配置
- 文件大小 < 5MB
- 格式：JPG、PNG

### 设计建议

- 重要信息放在中央区域
- 避免图片边缘放置关键文字
- 使用高对比度，确保在小尺寸下清晰可见
- 包含 Logo 和核心信息

## 故障排除

### 微信不显示图片

1. 确保图片路径正确：`/share.jpeg`
2. 检查图片格式和大小
3. 确认服务器正确响应图片请求
4. 微信可能有缓存，使用不同设备测试

### 标题/描述不更新

1. 清除微信缓存（重启微信 APP）
2. 确认 meta 标签语法正确
3. 检查网页是否正确渲染 HTML

### 测试命令

```bash
# 检查 meta 标签是否正确生成
curl -s https://your-domain.com | grep -E "og:|twitter:|title|description"

# 检查图片是否可访问
curl -I https://your-domain.com/share.jpeg
```

## 其他社交平台

配置支持多个平台：

- ✅ 微信/QQ
- ✅ 微博
- ✅ Facebook
- ✅ Twitter
- ✅ LinkedIn
- ✅ Telegram

## 注意事项

1. **域名配置**: 记得将 `url: "https://easylish.com"` 改为你的实际域名
2. **图片 URL**: 确保分享图片使用绝对 URL 路径
3. **缓存问题**: 社交平台有缓存机制，更新后可能需要一些时间生效
4. **移动端适配**: 已添加移动端优化的 meta 标签
