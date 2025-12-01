const NodeCache = require('node-cache');
const config = require('../config/constants');

class CacheManager {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.CACHE.TTL,
      checkperiod: config.CACHE.CHECK_PERIOD,
      useClones: false
    });
    
    this.stats = {
      hits: 0,
      misses: 0,
      keys: 0
    };
  }
  
  // Получить значение
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }
  
  // Установить значение
  set(key, value, ttl = null) {
    this.cache.set(key, value, ttl);
    this.stats.keys = this.cache.keys().length;
    return true;
  }
  
  // Удалить значение
  del(key) {
    return this.cache.del(key);
  }
  
  // Очистить кэш
  flush() {
    this.cache.flushAll();
    this.stats.keys = 0;
  }
  
  // Получить статистику
  getStats() {
    return {
      ...this.stats,
      total: this.stats.hits + this.stats.misses,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      size: this.cache.keys().length
    };
  }
  
  // Кэшировать результат функции
  async memoize(key, fn, ttl = null) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }
  
  // Кэш для пользователей
  getUser(userId) {
    return this.get(`user:${userId}`);
  }
  
  setUser(userId, userData, ttl = 300) {
    return this.set(`user:${userId}`, userData, ttl);
  }
  
  // Кэш для стикеров
  getSticker(fileId) {
    return this.get(`sticker:${fileId}`);
  }
  
  setSticker(fileId, stickerData, ttl = 600) {
    return this.set(`sticker:${fileId}`, stickerData, ttl);
  }
  
  // Кэш для топа
  getTopStickers() {
    return this.get('top:stickers');
  }
  
  setTopStickers(data, ttl = 60) {
    return this.set('top:stickers', data, ttl);
  }
  
  // Кэш для трендов
  getTrending() {
    return this.get('trending');
  }
  
  setTrending(data, ttl = 120) {
    return this.set('trending', data, ttl);
  }
}

module.exports = new CacheManager();
