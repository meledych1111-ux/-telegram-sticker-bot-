const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const path = require('path');

console.log('🚀 Запуск Telegram Sticker Bot...');
console.log('Node.js версия:', process.version);
console.log('Node.js 24 ✅');

// Проверка переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  console.log('');
  console.log('=== ДОБАВЬТЕ В VERCEL DASHBOARD ===');
  console.log('1. Settings → Environment Variables');
  console.log('2. Добавьте переменную:');
  console.log('   Name: TELEGRAM_BOT_TOKEN');
  console.log('   Value: 8497134153:AAEQtYTVv-hCQ08HkD6Wwm6k2qsjmCHCgJI');
  console.log('3. Передеплойте проект');
  console.log('====================================');
  process.exit(1);
}

// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// URL вебхука
const VERCEL_URL = process.env.VERCEL_URL || 'https://telegram-sticker-bot-tau.vercel.app';
const WEBHOOK_URL = `${VERCEL_URL}/api/bot`;

// ========== ИМПОРТ МОДУЛЕЙ ==========
const menu = require('./menu');
const database = require('../lib/database');
const imageProcessor = require('../lib/imageProcessor');

// Проверка соединения с БД
database.checkConnection().then(isConnected => {
  console.log(`💾 База данных: ${isConnected ? 'Neon ✅' : 'Недоступна ❌'}`);
});

// ========== ОБРАБОТЧИКИ КОМАНД ==========

// /start - главная команда
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    // Сохраняем пользователя в БД
    const dbUser = await database.getOrCreateUser(user);
    
    const welcomeText = `🎨 *Добро пожаловать в Sticker Bot, ${user.first_name || 'друг'}!*\n\n` +
      `🤖 Я помогу вам создавать красивые стикеры из любых изображений!\n\n` +
      `📸 *Как это работает:*\n` +
      `1. Отправьте мне фото или картинку\n` +
      `2. Выберите эффекты и рамку\n` +
      `3. Получите готовый стикер!\n\n` +
      `✨ *Доступные эффекты:*\n` +
      `• Разные рамки (цветные, градиентные)\n` +
      `• Перламутровый эффект\n` +
      `• Текстовые наложения\n` +
      `• Автоматическая обрезка\n\n` +
      `📊 *Ваша статистика:*\n` +
      `• Создано стикеров: ${dbUser?.stickers_created || 0}\n` +
      `• Рейтинг: ${dbUser?.rating || 'Новый'}\n` +
      `• В системе с: ${new Date(dbUser?.created_at).toLocaleDateString('ru-RU')}\n\n` +
      `*Используйте меню ниже или отправьте изображение!*`;
    
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu(user.first_name)
    });
    
  } catch (error) {
    console.error('❌ Ошибка /start:', error);
    await bot.sendMessage(chatId, 'Привет! Используйте меню ниже 👇', menu.mainMenu());
  }
});

// /help - помощь
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🆘 *Помощь по боту*\n\n` +
    `*Основные команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Эта справка\n` +
    `/stats - Ваша статистика\n` +
    `/top - Топ пользователей\n` +
    `/settings - Настройки\n\n` +
    `*Как создать стикер:*\n` +
    `1. Отправьте изображение (JPG, PNG, GIF, WEBP)\n` +
    `2. Выберите эффекты из меню\n` +
    `3. Настройте рамку и текст\n` +
    `4. Сохраните стикер\n\n` +
    `*Лимиты:*\n` +
    `• Размер файла: до 20MB\n` +
    `• Форматы: PNG, JPG, GIF, WEBP\n` +
    `• Стикеров на пользователя: 100\n` +
    `• Папок на пользователя: 10\n\n` +
    `*Проблемы?*\n` +
    `• Если стикер не создается, попробуйте другое изображение\n` +
    `• Убедитесь, что файл не превышает 20MB\n` +
    `• Перезапустите бота командой /start`;
  
  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    ...menu.mainMenu()
  });
});

// /stats - статистика
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    const stats = await database.getStats(user.id);
    
    let statsText = `📊 *Ваша статистика*\n\n`;
    
    if (stats) {
      statsText += `👤 *Профиль:*\n` +
                  `• Имя: ${stats.first_name}\n` +
                  `• Username: @${stats.username || 'нет'}\n` +
                  `• ID: \`${user.id}\`\n\n` +
                  `🎨 *Творчество:*\n` +
                  `• Создано стикеров: *${stats.stickers_created}*\n` +
                  `• Папок: *${stats.folders_count}*\n` +
                  `• Средний рейтинг: *${stats.avg_rating.toFixed(1)}/5*\n\n` +
                  `📈 *Активность:*\n` +
                  `• Просмотров: ${stats.total_views}\n` +
                  `• Лайков: ${stats.total_likes}\n` +
                  `• Зарегистрирован: ${new Date(stats.joined_date).toLocaleDateString('ru-RU')}\n` +
                  `• Был активен: ${new Date(stats.last_active).toLocaleString('ru-RU')}\n\n`;
    } else {
      statsText += `Вы еще не создали ни одного стикера!\n\n`;
    }
    
    statsText += `🌐 *Техническая информация:*\n` +
                `• Хостинг: Vercel (Node.js 24)\n` +
                `• База данных: Neon PostgreSQL\n` +
                `• Статус: ✅ Активен\n\n` +
                `*Создайте первый стикер и увеличьте свою статистику!*`;
    
    await bot.sendMessage(chatId, statsText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu()
    });
    
  } catch (error) {
    console.error('❌ Ошибка /stats:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить статистику', menu.mainMenu());
  }
});

// /top - топ пользователей
bot.onText(/\/top/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const topUsers = await database.getTopUsers(10);
    
    let topText = `👑 *Топ пользователей бота*\n\n`;
    
    topUsers.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▫️';
      topText += `${medal} *${user.first_name || user.username || 'Аноним'}*\n`;
      topText += `   Стикеров: ${user.stickers_created} | Лайков: ${user.total_likes}\n`;
      topText += `   Рейтинг: ${user.avg_rating?.toFixed(1) || '0.0'}/5\n\n`;
    });
    
    if (topUsers.length === 0) {
      topText += `Пока нет активных пользователей.\nБудьте первым! 🚀\n\n`;
    }
    
    topText += `📊 *Как попасть в топ?*\n` +
              `• Создавайте больше стикеров\n` +
              `• Получайте лайки за свои работы\n` +
              `• Делитесь стикерами с друзьями\n\n` +
              `*Удачи в творчестве!*`;
    
    await bot.sendMessage(chatId, topText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu()
    });
    
  } catch (error) {
    console.error('❌ Ошибка /top:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить топ', menu.mainMenu());
  }
});

// ========== ОБРАБОТКА ИЗОБРАЖЕНИЙ ==========

// Получение фото
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const photo = msg.photo[msg.photo.length - 1];
  
  try {
    await bot.sendChatAction(chatId, 'upload_photo');
    
    const progressMsg = await bot.sendMessage(
      chatId,
      '📸 *Получено изображение!*\n\n🔄 Обрабатываю...',
      { parse_mode: 'Markdown' }
    );
    
    // Получаем ссылку на файл
    const fileLink = await bot.getFileLink(photo.file_id);
    
    // Обрабатываем изображение
    const processed = await imageProcessor.processImage(fileLink, {
      addFrame: true,
      frameSize: 20,
      frameColor: 'white',
      addPearlEffect: true
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
      has_pearl_effect: true
    });
    
    // Отправляем обработанное изображение
    await bot.sendPhoto(chatId, processed.buffer, {
      caption: `✅ *Стикер готов!*\n\n` +
              `📐 Размер: ${processed.width}x${processed.height}\n` +
              `💾 Вес: ${(processed.size / 1024).toFixed(2)} KB\n` +
              `🎨 Эффекты: Рамка + Перламутр\n` +
              `🆔 ID: \`${sticker.id.slice(0, 8)}\`\n\n` +
              `*Чтобы использовать как стикер:*\n` +
              `1. Сохраните это изображение\n` +
              `2. В Telegram: "Новый стикер"\n` +
              `3. Выберите это фото\n\n` +
              `⭐ *Оценить стикер:* /rate_${sticker.id.slice(0, 8)}`,
      parse_mode: 'Markdown',
      ...menu.stickerActionsMenu(sticker.id)
    });
    
    // Удаляем сообщение о прогрессе
    await bot.deleteMessage(chatId, progressMsg.message_id);
    
  } catch (error) {
    console.error('❌ Ошибка обработки фото:', error);
    await bot.sendMessage(
      chatId,
      `❌ *Ошибка обработки!*\n\n` +
      `Причина: ${error.message || 'Неизвестная ошибка'}\n\n` +
      `Попробуйте:\n` +
      `• Другое изображение\n` +
      `• Меньший размер файла\n` +
      `• Формат PNG или JPG`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ========== VERCEL SERVERLESS HANDLER ==========

// Обработчик вебхука
app.post('/api/bot', async (req, res) => {
  try {
    await bot.processUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Ошибка вебхука:', error);
    res.status(500).json({ error: error.message });
  }
});

// API эндпоинты
app.get('/api/health', async (req, res) => {
  const dbConnected = await database.checkConnection();
  
  res.json({
    status: 'healthy',
    service: 'Telegram Sticker Bot',
    version: '4.0.0',
    runtime: 'Node.js 24',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbConnected ? 'connected' : 'disconnected',
    webhook: WEBHOOK_URL
  });
});

app.get('/api/setup-webhook', async (req, res) => {
  try {
    await bot.setWebHook(WEBHOOK_URL);
    const botInfo = await bot.getMe();
    
    res.json({
      success: true,
      message: 'Webhook установлен',
      bot: `@${botInfo.username}`,
      webhook: WEBHOOK_URL,
      database: await database.checkConnection() ? 'Neon ✅' : '❌'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Статическая страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ========== ЭКСПОРТ ДЛЯ VERCEL ==========
module.exports = app;

// ========== ЛОКАЛЬНЫЙ ЗАПУСК ==========
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  
  // Установка вебхука
  bot.setWebHook(WEBHOOK_URL).then(() => {
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
  }).catch(err => {
    console.error('❌ Ошибка вебхука:', err.message);
  });
  
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`🤖 Токен бота: ${BOT_TOKEN ? 'Установлен ✅' : 'Отсутствует ❌'}`);
  });
}
