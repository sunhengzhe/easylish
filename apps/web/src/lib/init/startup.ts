import { SubtitleSearchService } from '../services/subtitle-search-service';

/**
 * 应用启动初始化
 */
export class AppInitializer {
  private static isInitialized = false;
  private static initializationPromise: Promise<void> | null = null;

  /**
   * 初始化应用
   */
  static async initialize(): Promise<void> {
    // 防止重复初始化
    if (AppInitializer.isInitialized) {
      return;
    }

    if (AppInitializer.initializationPromise) {
      return AppInitializer.initializationPromise;
    }

    AppInitializer.initializationPromise = AppInitializer.doInitialize();
    await AppInitializer.initializationPromise;
  }

  private static async doInitialize(): Promise<void> {
    try {
      console.log('🌟 Initializing application...');
      const startTime = Date.now();

      // 初始化字幕搜索服务
      const subtitleService = SubtitleSearchService.getInstance();
      await subtitleService.initialize();

      const duration = Date.now() - startTime;
      console.log(`✅ Application initialized successfully in ${duration}ms`);

      AppInitializer.isInitialized = true;
    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      throw error;
    }
  }

  /**
   * 检查应用是否已初始化
   */
  static isReady(): boolean {
    return AppInitializer.isInitialized;
  }

  /**
   * 获取初始化状态
   */
  static getStatus() {
    return {
      isInitialized: AppInitializer.isInitialized,
      subtitleServiceReady: SubtitleSearchService.getInstance().isReady(),
    };
  }
}
