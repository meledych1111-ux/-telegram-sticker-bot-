// Production-ready Telegram Bot for Vercel
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Логирование
const logger = require('../lib/logger');
const database = require('../lib/database');
const imageProcessor = require('../lib/imageProcessor');
const menu = require('./menu');

console.log('🚀 PRODUCTION Telegram Sticker Bot');
console.log('📅', new Date().toISOString());
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('⚙️ Node.js:', process.version);

// ========== ВАЛИДАЦИЯ ТОКЕНА ==========
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN не настроен');
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN отсутствует');
  console.log('\n⚙️ НАСТРОЙКА В VERCEL:');
  console.log('1. Vercel Dashboard → Project → Settings → Environment Variables');
  console.log('2. Добавить: TELEGRAM_BOT_TOKEN = ваш_токен_от_BotFather');
  console.log('3. Добавить: NEON_DATABASE_URL = строка_подключения_от_neon');
  console.log('4. Redeploy проект');
  process.exit(1);
}

// Проверка формата токена
if (!/^\d{9,10}:[A-Za-z0-9_-]{35}$/.test(BOT_TOKEN)) {
  logger.error('Неверный формат токена');
  console.error('❌ НЕВЕРНЫЙ ФОРМАТ ТОКЕНА');
  console.log('Получите токен у @BotFather в Telegram');
  process.exit(1);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const bot = new TelegramBot(BOT_TOKEN, {
  polling: false,
  request: {
    timeout: 10000,
    agentOptions: {
      keepAlive: true,
      maxSockets: 50
    }
  }
});

const app = express();
const VERCEL_URL = process.env.VERCEL_URL || 'https://your-project.vercel.app';
const WEBHOOK_URL = `${VERCEL_URL}/api/bot`;

// ========== MIDDLEWARE ==========
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.telegram.org"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-project.vercel.app', 'https://telegram.org']
    : '*',
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const rateLimiter = new RateLimiterMemory({
  points: 100, // запросов
  duration: 60, // за 60 секунд
  blockDuration: 300 // блокировка на 5 минут
});

app.use((req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  
  rateLimiter.consume(clientIp)
    .then(() => next())
    .catch(() => {
      logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
      res.status(429).json({ 
        error: 'Слишком много запросов. Попробуйте позже.' 
      });
    });
});

// ========== ЗАЩИЩЕННЫЕ ЭНДПОИНТЫ ==========
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => id);

// Проверка админа
const isAdmin = (userId) => ADMIN_IDS.includes(userId);

// ========== ОСНОВНЫЕ КОМАНДЫ ==========

// /start
bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    // Логируем старт
    logger.info(`/start от ${user.id} (@${user.username || 'no-username'})`);
    
    // Регистрируем в БД
    await database.getOrCreateUser(user);
    
    const welcomeMessage = `🎉 *Добро пожаловать, ${user.first_name || 'друг'}!*\n\n` +
      `🤖 *Telegram Sticker Bot v${require('../package.json').version}*\n\n` +
      `📸 *Возможности:*\n` +
      `✅ Создание стикеров из любых изображений\n` +
      `🎨 Эффекты: рамки, фильтры, текст\n` +
      `💾 Сохранение в облачную базу\n` +
      `⭐ Рейтинг и топ пользователей\n` +
      `📂 Организация в папки\n\n` +
      `⚡ *Технологии:*\n` +
      `• Node.js 24\n` +
      `• Vercel Serverless\n` +
      `• Neon PostgreSQL\n\n` +
      `📊 *Статус:* ✅ Активен\n` +
      `🔒 *Безопасность:* TLS/SSL\n\n` +
      `*Используйте меню или отправьте изображение!*`;
    
    await bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      ...menu.mainMenu(user.first_name)
    });
    
  } catch (error) {
    logger.error('Ошибка в /start:', error);
  }
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🆘 *Помощь и поддержка*\n\n` +
    `📖 *Основные команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Эта справка\n` +
    `/stats - Ваша статистика\n` +
    `/top - Топ пользователей\n` +
    `/settings - Настройки\n\n` +
    `🖼️ *Создание стикера:*\n` +
    `1. Отправьте фото или PNG\n` +
    `2. Выберите эффекты\n` +
    `3. Настройте параметры\n` +
    `4. Скачайте готовый стикер\n\n` +
    `📊 *Лимиты:*\n` +
    `• Макс. размер: 20MB\n` +
    `• Форматы: JPG, PNG, WEBP\n` +
    `• Стикеров на аккаунт: 1000\n\n` +
    `🔧 *Техподдержка:*\n` +
    `• Баг-репорты: /report\n` +
    `• Предложения: /suggest\n` +
    `• Контакты: @ваш_никнейм\n\n` +
    `📞 *Аварийные контакты:*\n` +
    `• Админ: ${ADMIN_IDS.length > 0 ? ADMIN_IDS[0] : 'не настроен'}`;
  
  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    ...menu.mainMenu()
  });
});

// /stats
bot.onText(/\/stats/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    const stats = await database.getStats(user.id);
    
    let statsText = `📊 *Системная статистика*\n\n`;
    
    if (stats) {
      statsText += `👤 *Ваш профиль:*\n` +
                  `• ID: \`${user.id}\`\n` +
                  `• Стикеров: ${stats.stickers_created || 0}\n` +
                  `• Рейтинг: ${stats.avg_rating?.toFixed(1) || '0.0'}/5.0\n` +
                  `• В системе: ${new Date(stats.created_at).toLocaleDateString('ru-RU')}\n\n`;
    }
    
    // Системная статистика
    const dbStats = await database.getSystemStats();
    
    statsText += `🌐 *Система:*\n` +
                `• Пользователей: ${dbStats?.total_users || 0}\n` +
                `• Всего стикеров: ${dbStats?.total_stickers || 0}\n` +
                `• За сегодня: ${dbStats?.daily_stickers || 0}\n` +
                `• Uptime: ${Math.floor(process.uptime() / 3600)}ч\n\n` +
                `⚙️ *Инфраструктура:*\n` +
                `• Хостинг: Vercel\n` +
                `• Runtime: Node.js 24\n` +
                `• БД: Neon PostgreSQL\n` +
                `• Режим: ${process.env.NODE_ENV || 'development'}`;
    
    await bot.sendMessage(chatId, statsText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu()
    });
    
  } catch (error) {
    logger.error('Ошибка в /stats:', error);
  }
});

// ========== ОБРАБОТКА ИЗОБРАЖЕНИЙ ==========
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const photo = msg.photo[msg.photo.length - 1];
  
  try {
    // Проверяем размер
    if (photo.file_size > 20 * 1024 * 1024) {
      await bot.sendMessage(chatId, 
        '❌ *Файл слишком большой!*\nМаксимальный размер: 20MB',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    await bot.sendChatAction(chatId, 'upload_photo');
    
    const progressMsg = await bot.sendMessage(
      chatId,
      '📸 *Обработка изображения...*\n\n' +
      '🔄 Загрузка → Обработка → Создание стикера\n' +
      '⏱️ Это займет 5-10 секунд',
      { parse_mode: 'Markdown' }
    );
    
    // Получаем файл
    const fileLink = await bot.getFileLink(photo.file_id);
    
    // Обрабатываем изображение
    const processed = await imageProcessor.processImage(fileLink, {
      addFrame: true,
      frameSize: 20,
      frameColor: 'white',
      addPearlEffect: true,
      optimize: true
    });
    
    // Сохраняем в БД
    const dbUser = await database.getOrCreateUser(user);
    const sticker = await database.saveSticker({
      user_id: dbUser.id,
      telegram_file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      width: processed.width,
      height: processed.height,
      file_size: processed.size,
      has_frame: true,
      frame_color: 'white',
      has_pearl_effect: true,
      mime_type: 'image/png'
    });
    
    // Отправляем результат
    await bot.sendPhoto(chatId, processed.buffer, {
      caption: `✅ *Стикер создан!*\n\n` +
              `📐 Размер: ${processed.width}x${processed.height}\n` +
              `💾 Вес: ${(processed.size / 1024).toFixed(2)} KB\n` +
              `🎨 Формат: PNG (оптимизирован)\n` +
              `🆔 ID: \`${sticker.id?.slice(0, 8) || 'N/A'}\`\n\n` +
              `*Использование:*\n` +
              `1. Сохраните это изображение\n` +
              `2. В Telegram: Создать стикер\n` +
              `3. Выберите сохраненный файл\n\n` +
              `⭐ *Оценить:* /rate_${sticker.id?.slice(0, 8) || 'new'}`,
      parse_mode: 'Markdown',
      ...menu.stickerActionsMenu(sticker.id)
    });
    
    // Удаляем сообщение о прогрессе
    await bot.deleteMessage(chatId, progressMsg.message_id);
    
    logger.info(`Стикер создан для ${user.id}, размер: ${processed.size} байт`);
    
  } catch (error) {
    logger.error('Ошибка обработки фото:', error);
    
    await bot.sendMessage(chatId, 
      `❌ *Ошибка обработки*\n\n` +
      `Причина: ${error.message || 'Неизвестная ошибка'}\n\n` +
      `*Что делать:*\n` +
      `• Проверьте формат изображения\n` +
      `• Убедитесь, что размер < 20MB\n` +
      `• Попробуйте другое изображение\n` +
      `• Если проблема повторяется, сообщите админу`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ========== VERCEL HANDLER ==========

// Health check
app.get('/health', async (req, res) => {
  const dbStatus = await database.checkConnection();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    service: 'Telegram Sticker Bot',
    version: require('../package.json').version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
    },
    database: dbStatus ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV,
    webhook: WEBHOOK_URL
  });
});

// Webhook endpoint
app.post('/api/bot', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Валидация запроса
    if (!req.body || typeof req.body !== 'object') {
      logger.warn('Некорректный запрос к вебхуку');
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    // Логируем запрос
    if (req.body.update_id) {
      logger.debug(`Webhook update ${req.body.update_id} received`);
    }
    
    // Обрабатываем обновление
    await bot.processUpdate(req.body);
    
    const processingTime = Date.now() - startTime;
    logger.debug(`Webhook processed in ${processingTime}ms`);
    
    res.status(200).json({ 
      ok: true, 
      processing_time: processingTime 
    });
    
  } catch (error) {
    logger.error('Webhook error:', error);
    
    // Не раскрываем детали ошибки в продакшене
    const errorMessage = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;
    
    res.status(500).json({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Admin endpoint
app.get('/admin/stats', async (req, res) => {
  // Простая проверка по токену
  const adminToken = req.headers['x-admin-token'];
  
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const stats = await database.getSystemStats();
  const botInfo = await bot.getMe().catch(() => null);
  
  res.json({
    bot: botInfo,
    database: stats,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node: process.version,
      env: process.env.NODE_ENV
    }
  });
});

// Main endpoint
app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/index.html'));
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========

async function initialize() {
  try {
    // Проверяем БД
    const dbConnected = await database.checkConnection();
    if (!dbConnected) {
      logger.warn('База данных недоступна');
    }
    
    // Устанавливаем вебхук
    if (process.env.NODE_ENV === 'production') {
      await bot.setWebHook(WEBHOOK_URL);
      logger.info(`Webhook установлен: ${WEBHOOK_URL}`);
    }
    
    // Получаем информацию о боте
    const botInfo = await bot.getMe();
    logger.info(`Бот запущен: @${botInfo.username} (${botInfo.id})`);
    
    console.log('\n✅ БОТ УСПЕШНО ЗАПУЩЕН');
    console.log('=======================');
    console.log(`🤖 Бот: @${botInfo.username}`);
    console.log(`🌐 Webhook: ${WEBHOOK_URL}`);
    console.log(`💾 БД: ${dbConnected ? 'Neon ✅' : '❌'}`);
    console.log(`⚙️ Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log('=======================\n');
    
  } catch (error) {
    logger.error('Ошибка инициализации:', error);
    process.exit(1);
  }
}

// Автоматическая инициализация при запуске
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, async () => {
    console.log(`🚀 Server started on port ${PORT}`);
    await initialize();
  });
} else {
  // Для Vercel Serverless
  module.exports = app;
}
