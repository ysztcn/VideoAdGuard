/**
 * 缓存服务类 - 管理大模型检测结果的本地缓存
 */
export interface CacheItem {
  /** 广告是否存在 */
  exist: boolean;
  /** 商品名称列表 */
  good_name: string[];
  /** 广告时间段 */
  adTimeRanges: number[][];
  /** 检测结果是否可信（用于决定是否自动跳过） */
  isDetectionConfident: boolean;
  /** 创建时间戳 */
  createdAt: number;
}

export class CacheService {
  private static readonly CACHE_KEY = 'videoAdGuard_detectionCache';
  private static readonly LAST_CLEANUP_KEY = 'videoAdGuard_lastCleanupTime';
  private static readonly CACHE_EXPIRY_DAYS = 1; // 缓存过期时间：1天
  private static readonly CACHE_EXPIRY_MS = CacheService.CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  private static readonly CLEANUP_INTERVAL_MS = CacheService.CACHE_EXPIRY_MS; // 清理间隔：1天

  /**
   * 生成缓存键
   * @param bvid 视频BV号
   * @returns 缓存键
   */
  private static generateCacheKey(bvid: string): string {
    return `${bvid}`;
  }

  /**
   * 获取所有缓存数据
   * @returns 缓存数据对象
   */
  private static async getAllCache(): Promise<Record<string, CacheItem>> {
    try {
      const result = await chrome.storage.local.get(CacheService.CACHE_KEY);
      return result[CacheService.CACHE_KEY] || {};
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 获取缓存失败:', error);
      return {};
    }
  }

  /**
   * 保存所有缓存数据
   * @param cache 缓存数据对象
   */
  private static async saveAllCache(cache: Record<string, CacheItem>): Promise<void> {
    try {
      await chrome.storage.local.set({
        [CacheService.CACHE_KEY]: cache
      });
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 保存缓存失败:', error);
    }
  }

  /**
   * 检查缓存项是否过期
   * @param item 缓存项
   * @returns 是否过期
   */
  private static isExpired(item: CacheItem): boolean {
    const now = Date.now();
    return (now - item.createdAt) > CacheService.CACHE_EXPIRY_MS;
  }

  /**
   * 获取上次清理时间
   * @returns 上次清理时间戳
   */
  private static async getLastCleanupTime(): Promise<number> {
    try {
      const result = await chrome.storage.local.get(CacheService.LAST_CLEANUP_KEY);
      return result[CacheService.LAST_CLEANUP_KEY] || 0;
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 获取上次清理时间失败:', error);
      return 0;
    }
  }

  /**
   * 设置上次清理时间
   * @param timestamp 时间戳
   */
  private static async setLastCleanupTime(timestamp: number): Promise<void> {
    try {
      await chrome.storage.local.set({
        [CacheService.LAST_CLEANUP_KEY]: timestamp
      });
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 设置上次清理时间失败:', error);
    }
  }

  /**
   * 检查是否需要清理缓存
   * @returns 是否需要清理
   */
  private static async shouldCleanup(): Promise<boolean> {
    const lastCleanupTime = await CacheService.getLastCleanupTime();
    const now = Date.now();
    return (now - lastCleanupTime) > CacheService.CLEANUP_INTERVAL_MS;
  }

  /**
   * 清理过期的缓存项（仅在需要时执行）
   */
  public static async cleanExpiredCache(): Promise<void> {
    try {
      // 检查是否需要清理
      const needsCleanup = await CacheService.shouldCleanup();
      if (!needsCleanup) {
        console.log('【VideoAdGuard】[Cache] 距离上次清理时间不足1天，跳过清理');
        return;
      }

      await CacheService.forceCleanExpiredCache();
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 清理过期缓存失败:', error);
    }
  }

  /**
   * 强制清理过期的缓存项（忽略时间间隔限制）
   */
  public static async forceCleanExpiredCache(): Promise<void> {
    try {
      console.log('【VideoAdGuard】[Cache] 开始清理过期缓存...');
      const cache = await CacheService.getAllCache();
      let cleanedCount = 0;

      // 过滤掉过期的缓存项
      const cleanedCache: Record<string, CacheItem> = {};
      for (const [key, item] of Object.entries(cache)) {
        if (!CacheService.isExpired(item)) {
          cleanedCache[key] = item;
        } else {
          cleanedCount++;
        }
      }

      // 保存更新后的缓存和清理时间
      await CacheService.saveAllCache(cleanedCache);
      await CacheService.setLastCleanupTime(Date.now());

      if (cleanedCount > 0) {
        console.log(`【VideoAdGuard】[Cache] 清理了 ${cleanedCount} 个过期缓存项`);
      } else {
        console.log('【VideoAdGuard】[Cache] 没有过期缓存项需要清理');
      }
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 强制清理过期缓存失败:', error);
    }
  }

  /**
   * 从缓存中获取检测结果
   * @param bvid 视频BV号
   * @returns 缓存的检测结果，如果不存在或已过期则返回null
   */
  public static async getDetectionResult(bvid: string): Promise<CacheItem | null> {
    try {
      const cache = await CacheService.getAllCache();
      const cacheKey = CacheService.generateCacheKey(bvid);
      const item = cache[cacheKey];

      if (!item) {
        console.log(`【VideoAdGuard】[Cache] 未找到 ${bvid} 的缓存`);
        return null;
      }

      if (CacheService.isExpired(item)) {
        console.log(`【VideoAdGuard】[Cache] ${bvid} 的缓存已过期`);
        // 删除过期的缓存项
        delete cache[cacheKey];
        await CacheService.saveAllCache(cache);
        return null;
      }

      console.log(`【VideoAdGuard】[Cache] 找到 ${bvid} 的有效缓存`);

      // 向后兼容：如果缓存项没有isDetectionConfident字段，设置默认值
      if (item.isDetectionConfident === undefined) {
        item.isDetectionConfident = false;
      }

      return item;
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 获取缓存失败:', error);
      return null;
    }
  }

  /**
   * 保存检测结果到缓存
   * @param bvid 视频BV号
   * @param exist 广告是否存在
   * @param good_name 商品名称列表
   * @param adTimeRanges 广告时间段
   * @param isDetectionConfident 检测结果是否可信
   */
  public static async saveDetectionResult(
    bvid: string,
    exist: boolean,
    good_name: string[],
    adTimeRanges: number[][],
    isDetectionConfident: boolean = false
  ): Promise<void> {
    try {
      const cache = await CacheService.getAllCache();
      const cacheKey = CacheService.generateCacheKey(bvid);
      
      const cacheItem: CacheItem = {
        exist,
        good_name,
        adTimeRanges,
        isDetectionConfident,
        createdAt: Date.now()
      };

      cache[cacheKey] = cacheItem;
      await CacheService.saveAllCache(cache);
      
      console.log(`【VideoAdGuard】[Cache] 已保存 ${bvid} 的检测结果到缓存`);
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 保存缓存失败:', error);
    }
  }

  /**
   * 更新缓存中的广告时间段（用于手动调整后的同步）
   * @param bvid 视频BV号
   * @param adTimeRanges 最新的广告时间段
   */
  public static async updateAdTimeRanges(bvid: string, adTimeRanges: number[][]): Promise<void> {
    try {
      const cache = await CacheService.getAllCache();
      const cacheKey = CacheService.generateCacheKey(bvid);
      const item = cache[cacheKey];

      if (!item) {
        console.log(`【VideoAdGuard】[Cache] 未找到 ${bvid} 的缓存，跳过广告区间更新`);
        return;
      }

      item.adTimeRanges = adTimeRanges;
      item.exist = adTimeRanges.length > 0 ? true : false;
      item.createdAt = Date.now();

      await CacheService.saveAllCache(cache);
      console.log(`【VideoAdGuard】[Cache] 已同步 ${bvid} 的手动调整广告区间到缓存`);
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 更新广告区间缓存失败:', error);
    }
  }

  /**
   * 删除指定视频的缓存
   * @param bvid 视频BV号
   */
  public static async deleteDetectionResult(bvid: string): Promise<void> {
    try {
      const cache = await CacheService.getAllCache();
      const cacheKey = CacheService.generateCacheKey(bvid);
      
      if (cache[cacheKey]) {
        delete cache[cacheKey];
        await CacheService.saveAllCache(cache);
        console.log(`【VideoAdGuard】[Cache] 已删除 ${bvid} 的缓存`);
      }
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 删除缓存失败:', error);
    }
  }

  /**
   * 清空所有缓存
   */
  public static async clearAllCache(): Promise<void> {
    try {
      await chrome.storage.local.remove(CacheService.CACHE_KEY);
      console.log('【VideoAdGuard】[Cache] 已清空所有缓存');
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 清空缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  public static async getCacheStats(): Promise<{
    totalCount: number;
    expiredCount: number;
    validCount: number;
    totalSize: number;
    lastCleanupTime: number;
    nextCleanupTime: number;
  }> {
    try {
      const cache = await CacheService.getAllCache();
      const entries = Object.entries(cache);
      const lastCleanupTime = await CacheService.getLastCleanupTime();

      let expiredCount = 0;
      let validCount = 0;

      for (const [, item] of entries) {
        if (CacheService.isExpired(item)) {
          expiredCount++;
        } else {
          validCount++;
        }
      }

      return {
        totalCount: entries.length,
        expiredCount,
        validCount,
        totalSize: JSON.stringify(cache).length,
        lastCleanupTime,
        nextCleanupTime: lastCleanupTime + CacheService.CLEANUP_INTERVAL_MS
      };
    } catch (error) {
      console.warn('【VideoAdGuard】[Cache] 获取缓存统计失败:', error);
      return {
        totalCount: 0,
        expiredCount: 0,
        validCount: 0,
        totalSize: 0,
        lastCleanupTime: 0,
        nextCleanupTime: 0
      };
    }
  }
}
