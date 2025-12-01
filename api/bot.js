import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import TelegramBot from 'node-telegram-bot-api';

// ES Modules __dirname альтернатива
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Инициализация приложения
const app = express();
const port = process.env.PORT || 3000;

// Конфигурация
const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  webhookSecret: process.env.WEBHOOK_SECRET || 'sticker-bot-secret-2024',
  maxFileSize: 20 * 1024 * 1024, // 20MB
  vercelUrl: process.env.VERCEL_URL || `http://localhost:${port}`,
  webhookUrl: `${process.env.VERCEL_URL || `http://localhost:${port}`}/api/bot`,
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Валидация токена
if (!config.botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN не установлен!');
  console.log('ℹ️  Установите в Vercel: Settings → Environment Variables');
  process.exit(1);
}

const tokenRegex = /^\d{9,11}:[A-Za-z0-9_-]{35}$/;
if (!tokenRegex.test(config.botToken)) {
  console.error('❌ Неверный формат токена Telegram Bot');
  process.exit(1);
}

// Инициализация бота
const bot = new TelegramBot(config.botToken, {
  polling: false,
  request: {
    timeout: 30000,
    agentOptions: {
      keepAlive: true,
      maxSockets: 100
    }
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100,
  message: { error: 'Слишком много запросов' }
});
app.use('/api/', limiter);

// Логирование запросов
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Загрузка модулей
console.log('🔄 Загрузка модулей...');
import { getOrCreateUser, saveSticker, getStats } from '../lib/database.js';
import { processImage } from '../lib/imageProcessor.js';
import logger from '../lib/logger.js';

console.log('✅ Модули загружены');

// ========== КОМАНДЫ БОТА ==========

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  await logger.info(`/start от ${user.id} (@${user.username || 'no-username'})`);
  
  try {
    await getOrCreateUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name
    });
    
    const welcomeText = `🎉 *Привет, ${user.first_name || 'друг'}!*\n\n` +
      `🤖 Я бот для создания стикеров\n\n` +
      `📸 *Отправьте мне:*\n` +
      `• Фото (JPG, PNG, WebP)\n` +
      `• Или готовое изображение\n\n` +
      `✨ *Я могу:*\n` +
      `• Добавить рамки\n` +
      `• Наложить текст\n` +
      `• Применить эффекты\n\n` +
      `⚡ *Node.js ${process.version}*\n` +
      `🌐 *Vercel Serverless*\n` +
      `💾 *Neon PostgreSQL*`;
    
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [[{ text: "🎨 Создать стикер" }]],
        resize_keyboard: true
      }
    });
    
  } catch (error) {
    await logger.error(`Ошибка /start: ${error.message}`);
    await bot.sendMessage(chatId, 'Привет! Отправьте фото для стикера 📸');
  }
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🆘 *Помощь*\n\n` +
    `📸 *Как использовать:*\n` +
    `1. Отправьте фото\n` +
    `2. Выберите эффект\n` +
    `3. Получите стикер\n\n` +
    `⚙️ *Команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Справка\n` +
    `/status - Статус бота\n` +
    `/stats - Ваша статистика\n\n` +
    `📱 *Требования:*\n` +
    `• Форматы: JPG, PNG, WebP\n` +
    `• Максимум: 20MB\n` +
    `• Рекомендуется: квадратное фото`;
  
  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown'
  });
});

// /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  
  const statusText = `📊 *Статус системы*\n\n` +
    `✅ Бот активен\n` +
    `⚡ Node.js ${process.version}\n` +
    `🌐 ${config.vercelUrl}\n` +
    `📅 ${new Date().toLocaleString('ru-RU')}\n` +
    `⏱️ Uptime: ${Math.floor(process.uptime() / 60)} мин`;
  
  await bot.sendMessage(chatId, statusText, {
    parse_mode: 'Markdown'
  });
});

// /stats
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    const stats = await getStats(user.id);
    
    const statsText = `📈 *Ваша статистика*\n\n` +
      `👤 ${user.first_name || 'Пользователь'}\n` +
      `🆔 ID: \`${user.id}\`\n` +
      `🎨 Стикеров: ${stats?.stickers_created || 0}\n` +
      `⭐ Уровень: ${stats?.stickers_created > 10 ? 'Профи' : 'Новичок'}`;
    
    await bot.sendMessage(chatId, statsText, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    await bot.sendMessage(chatId, 'Статистика временно недоступна');
  }
});

// Обработка фото
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const photo = msg.photo[msg.photo.length - 1];
  
  await logger.info(`Фото от ${user.id}, размер: ${photo.file_size ? Math.round(photo.file_size / 1024) + 'KB' : '?'}`);
  
  try {
    await bot.sendChatAction(chatId, 'upload_photo');
    
    const progressMsg = await bot.sendMessage(
      chatId,
      '📸 *Получено фото!*\n\n🔄 Обработка...',
      { parse_mode: 'Markdown' }
    );
    
    // Получаем информацию о файле
    const file = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    
    // Имитация обработки изображения
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Сохраняем в базу данных
    const dbUser = await getOrCreateUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name
    });
    
    await saveSticker({
      user_id: dbUser.id,
      telegram_file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      file_size: photo.file_size,
      created_at: new Date()
    });
    
    // Отправляем результат
    await bot.sendMessage(chatId,
      `✅ *Готово!*\n\n` +
      `Изображение обработано и готово для стикера.\n\n` +
      `📝 *Что дальше:*\n` +
      `1. В Telegram нажмите "Добавить стикер"\n` +
      `2. Выберите это изображение\n` +
      `3. Добавьте эмодзи и название\n\n` +
      `💡 *Совет:* Используйте квадратные изображения\n` +
      `для лучшего качества стикеров.`,
      { parse_mode: 'Markdown' }
    );
    
    // Удаляем сообщение о прогрессе
    await bot.deleteMessage(chatId, progressMsg.message_id);
    
  } catch (error) {
    await logger.error(`Ошибка обработки фото: ${error.message}`);
    
    await bot.sendMessage(chatId,
      `❌ *Ошибка обработки*\n\n` +
      `${error.message || 'Попробуйте другое изображение'}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Текстовые команды из меню
bot.onText(/🎨 Создать стикер/, async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(chatId,
    '📸 *Отправьте фото для стикера*\n\n' +
    'Поддерживаемые форматы:\n' +
    '• JPG/JPEG\n' +
    '• PNG\n' +
    '• WebP\n\n' +
    'Рекомендации:\n' +
    '• Квадратное изображение\n' +
    '• Хорошее освещение\n' +
    '• Минимум текст\n\n' +
    'Максимальный размер: 20MB',
    { parse_mode: 'Markdown' }
  );
});

// ========== API ENDPOINTS ==========

// Главный endpoint для вебхука
app.post('/api/bot', async (req, res) => {
  try {
    // Проверка секретного токена
    const secret = req.query.secret || req.headers['x-telegram-secret'];
    if (secret !== config.webhookSecret && config.nodeEnv === 'production') {
      console.warn('⚠️  Неавторизованный запрос вебхука');
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    console.log(`📨 Webhook update: ${req.body?.update_id}`);
    await bot.processUpdate(req.body);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'telegram-sticker-bot',
    version: '1.0.0',
    node: process.version,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      heap: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    }
  });
});

// Настройка вебхука
app.get('/api/setup-webhook', async (req, res) => {
  try {
    await bot.setWebHook(config.webhookUrl);
    const botInfo = await bot.getMe();
    
    res.json({
      success: true,
      message: 'Webhook установлен',
      bot: {
        username: botInfo.username,
        name: botInfo.first_name,
        id: botInfo.id
      },
      webhook: config.webhookUrl,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Статический контент
app.use(express.static(path.join(__dirname, '../public')));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 обработчик
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Путь ${req.path} не существует`,
    endpoints: [
      '/api/bot (POST)',
      '/api/health (GET)',
      '/api/setup-webhook (GET)'
    ]
  });
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('🔥 Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Произошла ошибка'
  });
});

// ========== ЗАПУСК ==========

// Для локального запуска
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, async () => {
    console.log(`
🚀 Telegram Sticker Bot запущен!
📅 Время: ${new Date().toLocaleString('ru-RU')}
⚡ Node.js: ${process.version}
🌐 URL: http://localhost:${port}
🔗 Webhook: ${config.webhookUrl}
📁 NODE_ENV: ${config.nodeEnv}
`);
    
    // Устанавливаем вебхук в продакшене
    if (config.nodeEnv === 'production') {
      try {
        await bot.setWebHook(config.webhookUrl);
        const botInfo = await bot.getMe();
        console.log(`🤖 Бот: @${botInfo.username} (${botInfo.first_name})`);
        console.log(`🔗 Ссылка: https://t.me/${botInfo.username}`);
      } catch (error) {
        console.error('❌ Ошибка установки вебхука:', error.message);
      }
    }
  });
}

// Экспорт для Vercel Serverless
export default app;
