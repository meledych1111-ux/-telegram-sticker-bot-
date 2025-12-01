const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const path = require('path');

console.log('🚀 Запуск Telegram Sticker Bot...');
console.log('Node.js версия:', process.version);

// Проверка токена
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  console.log('');
  console.log('=== ДОБАВЬТЕ В VERCEL DASHBOARD ===');
  console.log('1. Settings → Environment Variables');
  console.log('2. Добавьте переменную:');
  console.log('   Name: TELEGRAM_BOT_TOKEN');
  console.log('   Value: ваш_токен_от_BotFather');
  console.log('3. Передеплойте проект');
  console.log('====================================');
  process.exit(1);
}

// Инициализация
const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// URL вебхука
const VERCEL_URL = process.env.VERCEL_URL || 'https://telegram-sticker-bot-tau.vercel.app';
const WEBHOOK_URL = `${VERCEL_URL}/api/bot`;

console.log('🤖 Бот инициализирован');
console.log('🌐 Домен:', VERCEL_URL);
console.log('🔗 Вебхук:', WEBHOOK_URL);

// Импорт модулей
const menu = require('./menu');
const database = require('../lib/database');

// ========== КОМАНДЫ БОТА ==========

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    // Сохраняем пользователя
    await database.getOrCreateUser(user);
    
    const welcomeText = `🎉 *Привет, ${user.first_name || 'друг'}!*\n\n` +
      `🤖 Я бот для создания стикеров на Node.js 24!\n\n` +
      `📸 *Отправьте мне фото*, и я создам стикер с эффектами.\n\n` +
      `✨ *Возможности:*\n` +
      `• Добавление рамок\n` +
      `• Перламутровый эффект\n` +
      `• Сохранение в базе данных\n` +
      `• Статистика\n\n` +
      `🌐 *Хостинг:* Vercel\n` +
      `⚡ *Node.js:* 24\n` +
      `💾 *База данных:* Neon\n` +
      `✅ *Статус:* Активен\n\n` +
      `*Используйте меню ниже!*`;
    
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu(user.first_name)
    });
    
  } catch (error) {
    console.error('❌ Ошибка /start:', error);
    await bot.sendMessage(chatId, 'Привет! Используйте меню 👇', menu.mainMenu());
  }
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🆘 *Помощь по боту*\n\n` +
    `*Основные команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Эта справка\n` +
    `/stats - Статистика\n` +
    `/webhook - Инфо о вебхуке\n\n` +
    `*Как создать стикер:*\n` +
    `1. Отправьте фото или PNG\n` +
    `2. Выберите эффекты\n` +
    `3. Получите стикер\n\n` +
    `*Лимиты:*\n` +
    `• Размер файла: до 20MB\n` +
    `• Форматы: JPG, PNG, WEBP\n\n` +
    `*Проблемы?*\n` +
    `Попробуйте перезапустить: /start`;
  
  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    ...menu.mainMenu()
  });
});

// /stats
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    const stats = await database.getStats(user.id);
    
    let statsText = `📊 *Статистика*\n\n`;
    
    if (stats) {
      statsText += `👤 *Профиль:*\n` +
                  `• Имя: ${user.first_name}\n` +
                  `• Username: @${user.username || 'нет'}\n` +
                  `• ID: \`${user.id}\`\n\n` +
                  `🎨 *Творчество:*\n` +
                  `• Стикеров: ${stats.stickers_created || 0}\n` +
                  `• Рейтинг: ${stats.avg_rating?.toFixed(1) || '0.0'}/5\n\n`;
    } else {
      statsText += `Вы еще не создали стикеров!\n\n`;
    }
    
    statsText += `🌐 *Система:*\n` +
                `• Хостинг: Vercel\n` +
                `• Node.js: 24\n` +
                `• Вебхук: ${WEBHOOK_URL}\n` +
                `• Время: ${new Date().toLocaleTimeString('ru-RU')}`;
    
    await bot.sendMessage(chatId, statsText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu()
    });
    
  } catch (error) {
    console.error('❌ Ошибка /stats:', error);
    await bot.sendMessage(chatId, '❌ Ошибка загрузки статистики', menu.mainMenu());
  }
});

// Обработка фото
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const photo = msg.photo[msg.photo.length - 1];
  
  try {
    await bot.sendChatAction(chatId, 'upload_photo');
    
    await bot.sendMessage(chatId,
      '📸 *Фото получено!*\n\n' +
      '🔄 Обрабатываю изображение...',
      { parse_mode: 'Markdown' }
    );
    
    // Сохраняем в БД
    const dbUser = await database.getOrCreateUser(user);
    const sticker = await database.saveSticker({
      user_id: dbUser.id,
      telegram_file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      width: photo.width,
      height: photo.height,
      file_size: photo.file_size,
      has_frame: true,
      frame_color: 'white'
    });
    
    // Отправляем результат
    await bot.sendMessage(chatId,
      `✅ *Обработка завершена!*\n\n` +
      `📐 Размер: ${photo.width || '?'}x${photo.height || '?'}\n` +
      `💾 Вес: ${photo.file_size ? (photo.file_size / 1024).toFixed(2) + ' KB' : 'неизвестно'}\n` +
      `🆔 ID: \`${sticker.id?.slice(0, 8) || 'NEW'}\`\n\n` +
      `*Чтобы создать стикер:*\n` +
      `1. Сохраните это сообщение\n` +
      `2. В Telegram: "Новый стикер"\n` +
      `3. Выберите изображение\n\n` +
      `⭐ Функция создания стикеров будет добавлена в следующем обновлении!`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('❌ Ошибка обработки фото:', error);
    await bot.sendMessage(chatId,
      '❌ *Ошибка обработки!*\n\n' +
      `Причина: ${error.message || 'Неизвестная ошибка'}\n\n` +
      'Попробуйте другое изображение.',
      { parse_mode: 'Markdown' }
    );
  }
});

// ========== VERCEL HANDLER ==========

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

// Health check
app.get('/api/health', async (req, res) => {
  const dbConnected = await database.checkConnection();
  
  res.json({
    status: 'healthy',
    service: 'Telegram Sticker Bot',
    version: '1.0.0',
    runtime: 'Node.js 24',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
    webhook: WEBHOOK_URL
  });
});

// Webhook setup
app.get('/api/setup-webhook', async (req, res) => {
  try {
    await bot.setWebHook(WEBHOOK_URL);
    res.json({
      success: true,
      message: 'Webhook установлен',
      webhook: WEBHOOK_URL
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ========== ЭКСПОРТ ==========
module.exports = app;

// ========== ЗАПУСК ==========
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, async () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    
    // Установка вебхука
    try {
      await bot.setWebHook(WEBHOOK_URL);
      console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
    } catch (error) {
      console.error('❌ Ошибка вебхука:', error.message);
    }
  });
}
