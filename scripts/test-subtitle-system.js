/**
 * 测试字幕系统的脚本
 * 运行: node scripts/test-subtitle-system.js
 */

const path = require('path');

// 模拟 Next.js 环境
process.env.NODE_ENV = 'development';

async function testSubtitleSystem() {
  try {
    console.log('🧪 Testing subtitle system...\n');

    // 动态导入 ES 模块
    const { SubtitleSearchService } = await import('../src/lib/services/subtitle-search-service.js');

    // 初始化服务
    const service = SubtitleSearchService.getInstance();
    const subtitlesDir = path.join(process.cwd(), 'data', 'subtitles');

    console.log('📁 Initializing service with directory:', subtitlesDir);
    await service.initialize(subtitlesDir);

    // 获取统计信息
    const stats = await service.getStats();
    console.log('📊 Service Statistics:', stats);

    // 测试搜索功能
    console.log('\n🔍 Testing search functionality...');

    const searchTests = [
      'love',
      'good morning',
      'hello',
      'you',
    ];

    for (const query of searchTests) {
      console.log(`\n🔎 Searching for: "${query}"`);
      const results = await service.search({
        query,
        limit: 3,
      });

      console.log(`   Found ${results.total} results (showing ${results.results.length}):`);
      results.results.forEach((result, index) => {
        console.log(`   ${index + 1}. [${result.entry.videoId}] ${result.entry.text.substring(0, 100)}...`);
        console.log(`      Time: ${Math.floor(result.entry.startTime / 1000)}s - ${Math.floor(result.entry.endTime / 1000)}s`);
        console.log(`      Score: ${result.score.toFixed(2)}`);
      });
    }

    // 测试建议功能
    console.log('\n💡 Testing suggestions...');
    const suggestions = await service.getSuggestions('good', 5);
    console.log('Suggestions for "good":', suggestions);

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSubtitleSystem();
