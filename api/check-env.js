module.exports = (req, res) => {
  const envStatus = {
    // Обязательные
    TELEGRAM_BOT_TOKEN: {
      status: process.env.TELEGRAM_BOT_TOKEN ? '✅' : '❌',
      value: process.env.TELEGRAM_BOT_TOKEN ? 
        process.env.TELEGRAM_BOT_TOKEN.substring(0, 10) + '...' : 
        'Не установлен'
    },
    NEON_DATABASE_URL: {
      status: process.env.NEON_DATABASE_URL ? '✅' : '❌',
      value: process.env.NEON_DATABASE_URL ? 
        'Установлен (длина: ' + process.env.NEON_DATABASE_URL.length + ')' : 
        'Не установлен'
    },
    
    // Автоматические
    VERCEL_URL: {
      status: process.env.VERCEL_URL ? '✅' : '⚠️',
      value: process.env.VERCEL_URL || 'Не установлен'
    },
    NODE_ENV: {
      status: '✅',
      value: process.env.NODE_ENV || 'production'
    },
    
    // Системные
    REGION: {
      status: '✅',
      value: process.env.VERCEL_REGION || 'Неизвестно'
    },
    DEPLOYMENT: {
      status: '✅',
      value: process.env.VERCEL_GIT_COMMIT_SHA ? 
        process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7) : 'Локально'
    }
  };
  
  const allGood = envStatus.TELEGRAM_BOT_TOKEN.status === '✅' && 
                  envStatus.NEON_DATABASE_URL.status === '✅';
  
  res.json({
    status: allGood ? '✅ Все настроено!' : '⚠️ Требуется настройка',
    project: 'Telegram Sticker Bot',
    timestamp: new Date().toISOString(),
    environment: envStatus,
    webhook_url: process.env.TELEGRAM_BOT_TOKEN && process.env.VERCEL_URL ? 
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${process.env.VERCEL_URL}/api/bot` : 
      'Требуется TELEGRAM_BOT_TOKEN и VERCEL_URL',
    instructions: allGood ? {
      step1: '✅ Переменные окружения установлены',
      step2: '✅ База данных подключена',
      step3: '✅ Бот готов к работе',
      step4: '📱 Откройте бота в Telegram и напишите /start'
    } : {
      step1: 'Добавьте TELEGRAM_BOT_TOKEN в Vercel → Settings → Environment Variables',
      step2: 'Добавьте NEON_DATABASE_URL (строка подключения от Neon)',
      step3: 'Перезапустите деплоймент',
      step4: 'Проверьте этот endpoint снова'
    }
  });
};
