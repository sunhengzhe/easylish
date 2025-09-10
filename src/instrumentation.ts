// Runs on server startup (Node.js runtime) to preload subtitles into memory.
export async function register() {
  try {
    // 仅在 Node.js 运行时执行，避免 Edge 环境引入 Node 内置模块
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { AppInitializer } = await import('@/lib/init/startup');
    await AppInitializer.initialize();
  } catch (err) {
    console.error('Instrumentation initialization failed:', err);
  }
}
