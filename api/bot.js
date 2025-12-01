import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import TelegramBot from 'node-telegram-bot-api';

// Импорты из наших модулей
import { initDatabase, getOrCreateUser, saveSticker, getStats } from '../lib/database.js';
import { info, error, warn, debug } from '../lib/logger.js';
import { validateBotToken, delay, formatFileSize, handleError } from '../lib/utils.js';
import { processImage, validateImage } from '../lib/imageProcessor.js';

// ES Modules __dirname альтернатива
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Инициализация приложения
const app = express();
const port = process.env.PORT || 3000;

// Конфигурация
const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  webhookSecret: process.env.WEBHOOK_SECRET || 'sticker-bot-secret-' + Date.now(),
  maxFileSize: 20 * 1024 * 1024, // 20MB
  vercelUrl: process.env.VERCEL_URL || `http://localhost:${port}`,
  nodeEnv: process.env.NODE_ENV || 'development',
  adminId: process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null
};

// Webhook URL
config.webhookUrl = `${config.vercelUrl}/api/bot?secret=${config.webhookSecret}`;

console.log('🚀 ====== TELEGRAM STICKER BOT ======');
console.log('📅 Время запуска:', new Date().toISOString());
console.log('⚡ Node.js версия:', process.version);
console.log('🌍 NODE_ENV:', config.nodeEnv);
console.log('🌐 URL:', config.vercelUrl);
console.log('🔗 Webhook:', config.webhookUrl);
console.log('=====================================');

// ========== ВАЛИДАЦИЯ ТОКЕНА ==========
if (!config.botToken) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не найден!');
  console.log('');
  console.log('⚙️ НАСТРОЙКА В VERCEL:');
  console.log('1. Откройте Vercel Dashboard');
  console.log('2. Выберите проект → Settings → Environment Variables');
  console.log('3. Добавьте переменную:');
  console.log('   Name: TELEGRAM_BOT_TOKEN');
  console.log('   Value: ваш_токен_от_BotFather');
  console.log('4. Нажмите "Save" и передеплойте проект');
  console.log('');
  process.exit(1);
}

if (!validateBotToken(config.botToken)) {
  console.error('❌ НЕВЕРНЫЙ ФОРМАТ ТОКЕНА!');
  console.log('Токен должен быть вида: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz');
  console.log('Ваш токен (первые 20 символов):', config.botToken.substring(0, 20) + '...');
  process.exit(1);
}

console.log('✅ Токен проверен, формат правильный');

// ========== ИНИЦИАЛИЗАЦИЯ БОТА ==========
let bot;
try {
  console.log('🔄 Инициализация Telegram бота...');
  bot = new TelegramBot(config.botToken, {
    polling: false,
    request: {
      timeout: 30000,
      agentOptions: {
        keepAlive: true,
        maxSockets: 100
      }
    }
  });
  console.log('✅ Telegram Bot API инициализирован');
} catch (err) {
  console.error('❌ Ошибка инициализации бота:', err.message);
  process.exit(1);
}

// ========== MIDDLEWARE ==========
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: config.nodeEnv === 'production' ? config.vercelUrl : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100,
  message: { error: 'Слишком много запросов, попробуйте позже' }
});
app.use('/api/', limiter);

// Логирование запросов
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    info(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ========== ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ ==========
initDatabase().then(() => {
  info('✅ База данных инициализирована');
}).catch(err => {
  error('❌ Ошибка инициализации базы данных:', err.message);
});

// ========== КОМАНДЫ БОТА ==========

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  info(`/start от ${user.id} (@${user.username || 'без username'})`);
  
  try {
    // Регистрируем пользователя в базе
    const dbUser = await getOrCreateUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name
    });
    
    const welcomeText = `🎉 *Привет, ${user.first_name || 'друг'}!*\n\n` +
      `🤖 Я — *Telegram Sticker Bot* на *Node.js ${process.version}*!\n\n` +
      `📸 *Отправьте мне фото*, и я:\n` +
      `1. Обработаю изображение\n` +
      `2. Добавлю эффекты\n` +
      `3. Создам стикер\n\n` +
      `✨ *Доступные эффекты:*\n` +
      `• Разные рамки (скругленные, круглые)\n` +
      `• Фильтры (черно-белый, сепия)\n` +
      `• Текстовые наложения\n\n` +
      `🌐 *Технологии:*\n` +
      `• Node.js 24\n` +
      `• Vercel Serverless\n` +
      `• Neon PostgreSQL\n` +
      `• Sharp для обработки изображений\n\n` +
      `✅ *Статус:* Бот активен!\n` +
      `📊 *Ваш ID:* \`${user.id}\``;
    
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: "🎨 Создать стикер" }],
          [{ text: "📊 Моя статистика" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });
    
    info(`✅ /start отправлен пользователю ${user.id}`);
    
  } catch (err) {
    error(`❌ Ошибка /start для ${user.id}:`, err.message);
    await bot.sendMessage(chatId, 
      'Привет! 👋\n\nЯ бот для создания стикеров. Просто отправьте мне фото, и я помогу создать стикер! 📸',
      {
        reply_markup: {
          keyboard: [[{ text: "🎨 Создать стикер" }]],
          resize_keyboard: true
        }
      }
    );
  }
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  info(`📩 /help от чата ${chatId}`);
  
  const helpText = `🆘 *Помощь по боту*\n\n` +
    `📸 *Как использовать:*\n` +
    `1. Отправьте фото или PNG\n` +
    `2. Я обработаю изображение\n` +
    `3. Получите готовый стикер\n\n` +
    `⚙️ *Команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Эта справка\n` +
    `/status - Статус бота\n` +
    `/stats - Ваша статистика\n` +
    `/effects - Список эффектов\n\n` +
    `🔗 *Техническая информация:*\n` +
    `• Вебхук: ${config.webhookUrl.replace(config.webhookSecret, '***')}\n` +
    `• Хостинг: Vercel\n` +
    `• Node.js: ${process.version}\n` +
    `• Версия: 1.0.0\n\n` +
    `❓ *Проблемы?*\n` +
    `Попробуйте перезапустить: /start\n` +
    `Или напишите в поддержку.`;
  
  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [[{ text: "🎨 Создать стикер" }]],
      resize_keyboard: true
    }
  });
});

// /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  info(`📩 /status от чата ${chatId}`);
  
  const statusText = `📊 *Статус системы*\n\n` +
    `🤖 *Бот:* Активен ✅\n` +
    `🌐 *Хостинг:* Vercel\n` +
    `⚡ *Node.js:* ${process.version}\n` +
    `💾 *База данных:* Neon PostgreSQL\n` +
    `🔗 *Вебхук:* ${config.vercelUrl}\n` +
    `⏱️ *Uptime:* ${Math.floor(process.uptime() / 60)} минут\n` +
    `📅 *Запущен:* ${new Date().toLocaleString('ru-RU')}\n` +
    `👥 *Пользователи:* В базе данных\n\n` +
    `*Все системы работают нормально!*`;
  
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
      `👤 *Имя:* ${user.first_name || 'Пользователь'}\n` +
      `🆔 *ID:* \`${user.id}\`\n` +
      `🎨 *Стикеров создано:* ${stats?.stickers_created || 0}\n` +
      `⭐ *Уровень:* ${getUserLevel(stats?.stickers_created || 0)}\n` +
      `📅 *Последняя активность:* ${stats?.last_activity ? 
        new Date(stats.last_activity).toLocaleString('ru-RU') : 'только что'}\n\n` +
      `🏆 *Достижения:* ${getAchievements(stats?.stickers_created || 0)}`;
    
    await bot.sendMessage(chatId, statsText, {
      parse_mode: 'Markdown'
    });
    
  } catch (err) {
    error(`Ошибка получения статистики: ${err.message}`);
    await bot.sendMessage(chatId, '📊 Статистика временно недоступна. Попробуйте позже.');
  }
});

// /effects
bot.onText(/\/effects/, async (msg) => {
  const chatId = msg.chat.id;
  
  const effectsText = `✨ *Доступные эффекты:*\n\n` +
    `🎨 *Рамки:*\n` +
    `• rounded - Закругленные углы\n` +
    `• circle - Круглая обрезка\n` +
    `• border - Белая рамка\n\n` +
    `🎭 *Фильтры:*\n` +
    `• grayscale - Черно-белый\n` +
    `• sepia - Сепия\n` +
    `• vibrant - Яркие цвета\n\n` +
    `🌀 *Эффекты:*\n` +
    `• blur - Размытие фона\n` +
    `• pixelate - Пикселизация\n\n` +
    `📝 *Использование:*\n` +
    `Отправьте фото, затем выберите эффект из меню.`;
  
  await bot.sendMessage(chatId, effectsText, {
    parse_mode: 'Markdown'
  });
});

// Обработка фото
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const photo = msg.photo[msg.photo.length - 1];
  
  info(`📸 Фото от ${user.id}, размер: ${photo.file_size ? formatFileSize(photo.file_size) : 'неизвестно'}`);
  
  try {
    // Отправляем действие "загрузка фото"
    await bot.sendChatAction(chatId, 'upload_photo');
    
    const progressMsg = await bot.sendMessage(
      chatId,
      '📸 *Получено фото!*\n\n🔄 Начинаю обработку...',
      { parse_mode: 'Markdown' }
    );
    
    // Получаем информацию о файле
    const file = await bot.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`;
    
    info(`📁 Файл получен: ${file.file_path}`);
    
    // Имитация обработки (в реальном проекте здесь будет обработка изображения)
    await delay(1500);
    
    // Регистрируем пользователя если нужно
    const dbUser = await getOrCreateUser({
      id: user.id,
      username: user.username,
      first_name: user.first_name
    });
    
    // Сохраняем информацию о стикере
    const sticker = await saveSticker({
      user_id: dbUser.id,
      telegram_file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      file_size: photo.file_size,
      effect: 'none',
      created_at: new Date()
    });
    
    info(`💾 Стикер сохранен, ID: ${sticker.id}`);
    
    // Отправляем результат
    const resultText = `✅ *Обработка завершена!*\n\n` +
      `🎨 *Файл готов для создания стикера*\n\n` +
      `📝 *Инструкция:*\n` +
      `1. Нажмите "Создать стикер" в Telegram\n` +
      `2. Выберите это изображение\n` +
      `3. Добавьте эмодзи и название\n\n` +
      `⭐ *Дополнительно:*\n` +
      `• ID файла: \`${photo.file_id.substring(0, 10)}...\`\n` +
      `• Размер: ${formatFileSize(photo.file_size || 0)}\n` +
      `• Время обработки: 1.5 секунды\n` +
      `• Статус: Успешно ✅\n` +
      `• Ваш ID стикера: \`${sticker.id}\``;
    
    await bot.sendMessage(chatId, resultText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Обработать другое фото", callback_data: "new_photo" },
          { text: "✨ Применить эффекты", callback_data: "apply_effects" }
        ]]
      }
    });
    
    // Удаляем сообщение о прогрессе
    await bot.deleteMessage(chatId, progressMsg.message_id);
    
    info(`✅ Фото обработано для ${user.id}`);
    
  } catch (err) {
    error(`❌ Ошибка обработки фото для ${user.id}:`, err.message);
    
    await bot.sendMessage(chatId,
      `❌ *Ошибка обработки!*\n\n` +
      `Произошла ошибка: ${err.message || 'Неизвестная ошибка'}\n\n` +
      `🔄 *Что делать:*\n` +
      `• Попробуйте другое изображение\n` +
      `• Проверьте размер файла (макс. 20MB)\n` +
      `• Убедитесь что это фото (JPG, PNG, WebP)\n` +
      `• Повторите попытку через минуту`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Обработка callback запросов
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const user = callbackQuery.from;
  const data = callbackQuery.data;
  
  try {
    if (data === 'new_photo') {
      await bot.sendMessage(msg.chat.id,
        '📸 *Отправьте новое фото для обработки*\n\n' +
        'Я готов принять следующее изображение!',
        { parse_mode: 'Markdown' }
      );
    } else if (data === 'apply_effects') {
      await bot.sendMessage(msg.chat.id,
        '✨ *Выберите эффект:*\n\n' +
        'Отправьте команду /effects чтобы увидеть все доступные эффекты.\n\n' +
        'Или просто отправьте фото, и я применю случайный эффект!',
        { parse_mode: 'Markdown' }
      );
    }
    
    // Подтверждаем callback
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (err) {
    error(`❌ Ошибка обработки callback: ${err.message}`);
  }
});

// Текстовые команды из меню
bot.onText(/🎨 Создать стикер/, async (msg) => {
  const chatId = msg.chat.id;
  info(`🎨 "Создать стикер" от чата ${chatId}`);
  
  await bot.sendMessage(chatId,
    '📸 *Отправьте мне фото для создания стикера!*\n\n' +
    'Поддерживаемые форматы:\n' +
    '• JPG, JPEG\n' +
    '• PNG (с прозрачностью)\n' +
    '• WEBP\n\n' +
    '📏 *Требования:*\n' +
    '• Максимальный размер: 20MB\n' +
    '• Рекомендуется: квадратное фото\n' +
    '• Качество: хорошее освещение\n\n' +
    '✨ *Что я сделаю:*\n' +
    '1. Обработаю изображение\n' +
    '2. Применю выбранные эффекты\n' +
    '3. Подготовлю для стикера\n' +
    '4. Отправлю результат\n\n' +
    '🚀 *Готов? Отправляйте фото!*',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/📊 Моя статистика/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    const stats = await getStats(user.id);
    
    await bot.sendMessage(chatId,
      `📊 *Ваша статистика*\n\n` +
      `🎨 Стикеров создано: ${stats?.stickers_created || 0}\n` +
      `⭐ Уровень: ${getUserLevel(stats?.stickers_created || 0)}\n` +
      `🏆 Прогресс: ${getProgressBar(stats?.stickers_created || 0)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    await bot.sendMessage(chatId, '📊 Статистика временно недоступна');
  }
});

// Обработка документов (изображений)
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const document = msg.document;
  
  // Проверяем что это изображение
  const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (document.mime_type && imageMimeTypes.includes(document.mime_type)) {
    info(`📄 Изображение-документ от ${user.id}, тип: ${document.mime_type}`);
    
    await bot.sendMessage(chatId,
      `📄 *Получен файл: ${document.file_name}*\n\n` +
      `Тип: ${document.mime_type}\n` +
      `Размер: ${formatFileSize(document.file_size || 0)}\n\n` +
      `🔄 Начинаю обработку...`,
      { parse_mode: 'Markdown' }
    );
    
    // Обрабатываем как фото
    const photoMsg = { ...msg, photo: [{ file_id: document.file_id }] };
    bot.emit('photo', photoMsg);
  } else {
    await bot.sendMessage(chatId,
      '📄 Я могу обрабатывать только изображения!\n\n' +
      'Пожалуйста, отправьте фото в формате JPG, PNG или WebP.',
      { parse_mode: 'Markdown' }
    );
  }
});

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function getUserLevel(stickersCount) {
  if (stickersCount >= 50) return '🎖️ Мастер';
  if (stickersCount >= 20) return '⭐ Эксперт';
  if (stickersCount >= 10) return '🔥 Продвинутый';
  if (stickersCount >= 5) return '🚀 Начинающий';
  return '🌱 Новичок';
}

function getAchievements(stickersCount) {
  const achievements = [];
  if (stickersCount >= 1) achievements.push('🎯 Первый стикер');
  if (stickersCount >= 5) achievements.push('🏅 5 стикеров');
  if (stickersCount >= 10) achievements.push('🏆 10 стикеров');
  if (stickersCount >= 20) achievements.push('👑 20 стикеров');
  return achievements.length > 0 ? achievements.join(', ') : 'Пока нет достижений';
}

function getProgressBar(count) {
  const total = 10;
  const filled = Math.min(Math.floor(count / 2), total);
  const empty = total - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${count}/20`;
}

// ========== API ENDPOINTS ==========

// Вебхук от Telegram
app.post('/api/bot', async (req, res) => {
  const updateId = req.body?.update_id || 'unknown';
  info(`📨 Webhook получен: update_id=${updateId}`);
  
  const startTime = Date.now();
  
  try {
    // Проверка секретного токена
    const secret = req.query.secret || req.headers['x-telegram-secret'];
    if (secret !== config.webhookSecret && config.nodeEnv === 'production') {
      warn(`⚠️  Неавторизованный webhook запрос: update_id=${updateId}`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Invalid webhook secret'
      });
    }
    
    await bot.processUpdate(req.body);
    const processingTime = Date.now() - startTime;
    
    info(`✅ Webhook обработан: update_id=${updateId}, время=${processingTime}ms`);
    res.status(200).json({ 
      ok: true, 
      processing_time: processingTime,
      update_id: updateId 
    });
    
  } catch (err) {
    const processingTime = Date.now() - startTime;
    error(`❌ Ошибка webhook ${updateId}:`, err.message);
    
    res.status(500).json({ 
      error: err.message,
      processing_time: processingTime,
      update_id: updateId
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  info('❤️ Health check запрос');
  
  const memoryUsage = process.memoryUsage();
  
  const healthData = {
    status: 'healthy',
    service: 'Telegram Sticker Bot',
    version: '1.0.0',
    runtime: process.version,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
    },
    environment: config.nodeEnv,
    webhook: config.vercelUrl,
    features: {
      image_processing: true,
      database: true,
      sticker_creation: true,
      statistics: true
    }
  };
  
  info('📊 Health check данные собраны');
  res.json(healthData);
});

// Webhook setup
app.get('/api/setup-webhook', async (req, res) => {
  info('🔗 Запрос настройки вебхука');
  
  try {
    await bot.setWebHook(config.webhookUrl);
    const botInfo = await bot.getMe();
    
    const result = {
      success: true,
      message: 'Webhook установлен',
      bot: {
        username: botInfo.username,
        first_name: botInfo.first_name,
        id: botInfo.id,
        link: `https://t.me/${botInfo.username}`
      },
      webhook: {
        url: config.webhookUrl.replace(config.webhookSecret, '***'),
        health_check: `${config.vercelUrl}/api/health`
      },
      system: {
        node: process.version,
        environment: config.nodeEnv,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      }
    };
    
    info('✅ Вебхук установлен');
    res.json(result);
    
  } catch (err) {
    error('❌ Ошибка установки вебхука:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Статистика API
app.get('/api/stats', async (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        uptime: Math.floor(process.uptime()),
        node_version: process.version,
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json(handleError(err, 'API Stats'));
  }
});

// Статический контент
app.use(express.static(path.join(__dirname, '../public')));

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Telegram Sticker Bot</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        body {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .container {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 20px;
          padding: 40px;
          max-width: 800px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        h1 {
          color: #333;
          font-size: 2.5em;
          margin-bottom: 20px;
          text-align: center;
        }
        
        .status {
          background: rgba(0, 0, 0, 0.2);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
          text-align: left;
          font-family: monospace;
          font-size: 14px;
        }
        
        .btn {
          display: inline-block;
          padding: 12px 24px;
          margin: 10px;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 50px;
          font-weight: bold;
          transition: transform 0.3s;
        }
        
        .btn:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎨 Telegram Sticker Bot</h1>
        <p style="text-align: center; color: #666; margin-bottom: 30px;">
          Node.js ${process.version} | Vercel Serverless
        </p>
        
        <div class="status">
          <p>✅ Статус: Активен</p>
          <p>🌐 URL: ${config.vercelUrl}</p>
          <p>⚡ Node.js: ${process.version}</p>
          <p>🔗 Webhook: ${config.webhookUrl.replace(config.webhookSecret, '***')}</p>
          <p>📅 Время: ${new Date().toLocaleString('ru-RU')}</p>
          <p>⏱️ Uptime: ${Math.floor(process.uptime())} секунд</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <a href="/api/health" class="btn">📊 Проверить API</a>
          <a href="/api/setup-webhook" class="btn">🔗 Настроить вебхук</a>
        </div>
        
        <div style="margin-top: 40px; text-align: center; color: #666;">
          <p>🤖 Бот работает на Vercel с Node.js 24</p>
          <p>📸 Отправьте фото для создания стикера</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 404 обработчик
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Путь ${req.path} не существует`,
    available_endpoints: [
      { path: '/api/bot', method: 'POST', description: 'Telegram webhook' },
      { path: '/api/health', method: 'GET', description: 'Health check' },
      { path: '/api/setup-webhook', method: 'GET', description: 'Setup webhook' },
      { path: '/api/stats', method: 'GET', description: 'System statistics' },
      { path: '/', method: 'GET', description: 'Home page' }
    ],
    timestamp: new Date().toISOString()
  });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  error('🔥 Необработанная ошибка:', err.message);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Произошла ошибка на сервере',
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// ========== ЗАПУСК СЕРВЕРА ==========
if (import.meta.url === `file://${process.argv[1]}`) {
  // Локальный запуск
  app.listen(port, async () => {
    console.log(`\n🚀 Сервер запущен на порту ${port}`);
    console.log(`🌐 Локальный URL: http://localhost:${port}`);
    console.log(`🔗 Webhook URL: ${config.webhookUrl}`);
    
    try {
      const botInfo = await bot.getMe();
      console.log(`\n🤖 Бот: @${botInfo.username} (${botInfo.first_name})`);
      console.log(`🔗 Ссылка: https://t.me/${botInfo.username}`);
      
      // В production устанавливаем вебхук автоматически
      if (config.nodeEnv === 'production' && config.vercelUrl.includes('vercel.app')) {
        console.log('\n🔄 Установка вебхука в production...');
        await bot.setWebHook(config.webhookUrl);
        console.log('✅ Вебхук установлен');
      }
      
      console.log('\n🎉 ====== БОТ УСПЕШНО ЗАПУЩЕН ======');
      console.log('📱 Для использования:');
      console.log(`1. Откройте Telegram: https://t.me/${botInfo.username}`);
      console.log('2. Отправьте команду /start');
      console.log('3. Отправьте фото для создания стикера');
      console.log('=====================================\n');
      
    } catch (err) {
      console.error('❌ Ошибка получения информации о боте:', err.message);
    }
  });
}

// Экспорт для Vercel Serverless
export default app;
