const db = require('../lib/database');
const cache = require('../lib/cache');

module.exports = async (req, res) => {
  try {
    // Проверка соединения с базой данных
    let dbStatus = 'unknown';
    try {
      await db.pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
      console.error('Database connection check failed:', error.message);
    }
    
    // Получаем статистику
    let stats = {};
    try {
      stats = await db.getBotStats();
    } catch (error) {
      console.error('Failed to get bot stats:', error.message);
    }
    
    // Статистика кэша
    const cacheStats = cache.getStats();
    
    // Информация о системе
    const systemInfo = {
      node: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      uptime: Math.floor(process.uptime()),
      env: process.env.NODE_ENV || 'development'
    };
    
    // Формируем ответ
    const response = {
      status: 'ok',
      service: 'Telegram Sticker Bot',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        url: process.env.DATABASE_URL ? 'configured' : 'not configured'
      },
      telegram: {
        token: process.env.BOT_TOKEN ? 'configured' : 'not configured',
        webhook: process.env.VERCEL_URL || 'not configured'
      },
      statistics: stats,
      cache: cacheStats,
      system: systemInfo,
      endpoints: {
        webhook: '/api/bot',
        status: '/api/status',
        home: '/'
      }
    };
    
    // Отправляем ответ
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Status endpoint error:', error);
    
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
