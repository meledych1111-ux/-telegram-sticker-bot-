const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { processImage, addText, addFrame, addPearlEffect, addGradientEffect } = require('../lib/imageProcessor');
const { initDatabase, saveSticker, getUserStickers, createFolder, getFolders, getStats, getUser, updateStats } = require('../lib/database');
const { showMainMenu, showEffectsMenu, showColorMenu, showFoldersMenu, showStickersMenu, showStatsMenu, showSettingsMenu, showHelpMenu, showDeleteConfirmMenu, showFavoritesMenu, showTopUsersMenu } = require('./menu');

const app = express();
app.use(express.json());

// ================= НАСТРОЙКА =================
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  process.exit(1);
}

const bot = new TelegramBot(token);

// Установка команд
bot.setMyCommands([
  { command: 'start', description: '🚀 Запустить бота' },
  { command: 'menu', description: '📱 Главное меню' },
  { command: 'help', description: '❓ Помощь' }
]);

// Инициализация БД
initDatabase();

// Хранилище сессий
const userSessions = {};

// ================= WEBHOOK =================
app.post('/api/bot', async (req, res) => {
  try {
    const update = req.body;

    // Сообщения
    if (update.message) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const messageText = update.message.text;

      // Регистрация
      await getUser(userId, update.message.from.username || update.message.from.first_name);

      // Текстовые команды
      if (messageText) {
        await handleTextMessage(chatId, userId, messageText);
      }

      // Фото (JPEG)
      if (update.message.photo) {
        await handlePhoto(chatId, userId, update.message.photo);
      }

      // Документы (PNG)
      if (update.message.document) {
        await handleDocument(chatId, userId, update.message.document);
      }
    }

    // Callback кнопки
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Ошибка в обработчике:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ================= ОБРАБОТКА ТЕКСТА =================
async function handleTextMessage(chatId, userId, text) {
  switch (text) {
    case '/start':
      await bot.sendMessage(chatId, 
        '🎨 *Добро пожаловать в Sticker Bot!*\n\n' +
        'Я создам для вас красивые стикеры из ваших фото!\n' +
        'Просто отправьте мне изображение или используйте меню ниже.',
        { parse_mode: 'Markdown' }
      );
      await showMainMenu(bot, chatId);
      break;

    case '/menu':
    case 'меню':
    case 'Меню':
      await showMainMenu(bot, chatId);
      break;

    case '🎨 Создать стикер':
      await bot.sendMessage(chatId, 
        '📸 *Отправьте мне фото или PNG файл*\n\n' +
        'Поддерживаются: JPEG, PNG\n' +
        'Я обрежу в квадрат и добавлю эффекты!',
        { parse_mode: 'Markdown' }
      );
      userSessions[userId] = { state: 'awaiting_image' };
      break;

    case '📁 Мои стикеры':
      await showMyStickers(chatId, userId);
      break;

    case '📂 Папки':
      await showMyFolders(chatId, userId);
      break;

    case '⭐ Избранное':
      await showFavoritesMenu(bot, chatId);
      break;

    case '📊 Статистика':
      await showMyStats(chatId, userId);
      break;

    case '⚙️ Настройки':
      await showSettingsMenu(bot, chatId);
      break;

    case 'ℹ️ Помощь':
      await showHelpMenu(bot, chatId);
      break;

    case '👑 Топ':
      await showTopUsers(chatId);
      break;

    case '/help':
      await bot.sendMessage(chatId,
        '❓ *Помощь по боту*\n\n' +
        'Основные команды:\n' +
        '• /start - Запустить бота\n' +
        '• /menu - Главное меню\n\n' +
        'Используйте кнопочное меню для навигации!',
        { parse_mode: 'Markdown' }
      );
      break;

    default:
      // Текст для стикера
      if (userSessions[userId]?.state === 'awaiting_text') {
        userSessions[userId].text = text;
        await bot.sendMessage(chatId, `✅ Текст добавлен: "${text}"`);
        await showEffectsMenu(bot, chatId);
      }
      // Название папки
      else if (userSessions[userId]?.state === 'awaiting_folder_name') {
        await createFolderAction(chatId, userId, text);
      }
      else {
        await bot.sendMessage(chatId, 'Используйте меню или отправьте фото 🎨');
      }
  }
}

// ================= ОБРАБОТКА ФОТО (JPEG) =================
async function handlePhoto(chatId, userId, photoArray) {
  if (userSessions[userId]?.state !== 'awaiting_image') {
    await bot.sendMessage(chatId, '📸 Получено фото! Нажмите "🎨 Создать стикер" для обработки.');
    return;
  }

  try {
    await bot.sendMessage(chatId, '🔄 Обрабатываю JPEG фото...');

    const fileId = photoArray[photoArray.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    userSessions[userId] = {
      state: 'awaiting_effects',
      imageUrl: fileUrl,
      fileId: fileId
    };

    await showEffectsMenu(bot, chatId);
  } catch (error) {
    console.error('❌ Ошибка загрузки JPEG:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить фото');
  }
}

// ================= ОБРАБОТКА PNG =================
async function handleDocument(chatId, userId, document) {
  // Проверяем формат
  if (!['image/png', 'image/jpeg'].includes(document.mime_type)) {
    await bot.sendMessage(chatId, '❌ Пожалуйста, отправьте PNG или JPEG изображение');
    return;
  }

  if (userSessions[userId]?.state !== 'awaiting_image') {
    await bot.sendMessage(chatId, `📎 Получен ${document.mime_type}! Нажмите "🎨 Создать стикер" для обработки.`);
    return;
  }

  try {
    await bot.sendMessage(chatId, `🔄 Обрабатываю ${document.mime_type}...`);

    const file = await bot.getFile(document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    userSessions[userId] = {
      state: 'awaiting_effects',
      imageUrl: fileUrl,
      fileId: document.file_id,
      mimeType: document.mime_type
    };

    await showEffectsMenu(bot, chatId);
  } catch (error) {
    console.error('❌ Ошибка загрузки файла:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить файл');
  }
}

// ================= CALLBACK КНОПКИ =================
async function handleCallback(callback) {
  const chatId = callback.message.chat.id;
  const userId = callback.from.id;
  const data = callback.data;

  try {
    // Эффекты
    if (data === 'effect_text') {
      await bot.sendMessage(chatId, '✏️ Введите текст для стикера:');
      userSessions[userId] = { ...userSessions[userId], state: 'awaiting_text' };
    }
    else if (data === 'effect_frame') {
      await showColorMenu(bot, chatId);
    }
    else if (data === 'effect_pearl') {
      await createSticker(chatId, userId, 'pearl');
    }
    else if (data === 'effect_gradient') {
      await createSticker(chatId, userId, 'gradient');
    }
    else if (data === 'effect_none') {
      await createSticker(chatId, userId, 'none');
    }
    else if (data === 'effect_finish') {
      const session = userSessions[userId];
      const effect = session?.selectedEffect || 'none';
      await createSticker(chatId, userId, effect);
    }

    // Цвета рамки
    else if (data.startsWith('color_')) {
      const color = data.replace('color_', '');
      userSessions[userId] = { 
        ...userSessions[userId], 
        frameColor: color,
        selectedEffect: 'frame'
      };
      await bot.sendMessage(chatId, `✅ Цвет рамки: ${color}`);
      await showEffectsMenu(bot, chatId);
    }

    // Навигация
    else if (data === 'back_to_effects') {
      await showEffectsMenu(bot, chatId);
    }
    else if (data === 'back_to_main') {
      await showMainMenu(bot, chatId);
    }
    else if (data === 'cancel' || data === 'cancel_delete') {
      delete userSessions[userId];
      await bot.sendMessage(chatId, '❌ Действие отменено');
      await showMainMenu(bot, chatId);
    }

    // Папки
    else if (data === 'create_folder') {
      await bot.sendMessage(chatId, '📝 Введите название для новой папки:');
      userSessions[userId] = { state: 'awaiting_folder_name' };
    }
    else if (data === 'delete_folder_menu') {
      await showDeleteConfirmMenu(bot, chatId, 'folder');
    }

    // Статистика
    else if (data === 'stats_refresh') {
      await showMyStats(chatId, userId);
    }
    else if (data === 'stats_top') {
      await showTopUsers(chatId);
    }

    await bot.answerCallbackQuery(callback.id);
  } catch (error) {
    console.error('❌ Ошибка callback:', error);
    await bot.answerCallbackQuery(callback.id, { text: '❌ Ошибка' });
  }
}

// ================= СОЗДАНИЕ СТИКЕРА =================
async function createSticker(chatId, userId, effectType) {
  try {
    const session = userSessions[userId];
    if (!session?.imageUrl) {
      await bot.sendMessage(chatId, '❌ Изображение не найдено');
      return;
    }

    await bot.sendMessage(chatId, '🎨 Создаю стикер...');

    // Обработка
    let imageBuffer = await processImage(session.imageUrl);

    // Текст
    if (session.text) {
      imageBuffer = await addText(imageBuffer, session.text);
    }

    // Эффекты
    if (effectType === 'frame') {
      const color = session.frameColor || 'white';
      imageBuffer = await addFrame(imageBuffer, color);
    } else if (effectType === 'pearl') {
      imageBuffer = await addPearlEffect(imageBuffer);
    } else if (effectType === 'gradient') {
      imageBuffer = await addGradientEffect(imageBuffer);
    }

    // Сохранение
    const stickerId = await saveSticker(userId, imageBuffer, effectType, session.text || '');
    await updateStats(userId);

    // Отправка
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: `✅ *Стикер создан!*\n\n` +
        `ID: #${stickerId}\n` +
        `Эффект: ${effectType}\n` +
        `${session.text ? `Текст: "${session.text}"` : ''}`,
      parse_mode: 'Markdown'
    });

    // Очистка
    delete userSessions[userId];

    // Дальнейшие действия
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📁 Сохранить в папку', callback_data: 'save_to_folder' },
          { text: '⭐ В избранное', callback_data: 'add_to_fav' }
        ],
        [
          { text: '🎨 Создать еще', callback_data: 'create_another' },
          { text: '📋 В меню', callback_data: 'back_to_main' }
        ]
      ]
    };

    await bot.sendMessage(chatId, 'Что дальше?', { reply_markup: keyboard });

  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании стикера');
  }
}

// ================= ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =================
async function showMyStickers(chatId, userId) {
  try {
    const stickers = await getUserStickers(userId);
    await showStickersMenu(bot, chatId, stickers);
  } catch (error) {
    console.error('❌ Ошибка стикеров:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить стикеры');
  }
}

async function showMyFolders(chatId, userId) {
  try {
    const folders = await getFolders(userId);
    await showFoldersMenu(bot, chatId, folders);
  } catch (error) {
    console.error('❌ Ошибка папок:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить папки');
  }
}

async function showMyStats(chatId, userId) {
  try {
    const stats = await getStats(userId);
    await showStatsMenu(bot, chatId, stats);
  } catch (error) {
    console.error('❌ Ошибка статистики:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить статистику');
  }
}

async function createFolderAction(chatId, userId, folderName) {
  try {
    if (!folderName || folderName.length > 50) {
      await bot.sendMessage(chatId, '❌ Название должно быть 1-50 символов');
      return;
    }

    const folder = await createFolder(userId, folderName);
    await bot.sendMessage(chatId, `✅ Папка "${folderName}" создана!`);
    delete userSessions[userId];
    await showMyFolders(chatId, userId);
  } catch (error) {
    console.error('❌ Ошибка создания папки:', error);
    await bot.sendMessage(chatId, '❌ Не удалось создать папку');
  }
}

async function showTopUsers(chatId) {
  const { getTopUsers } = require('../lib/database');
  try {
    const topUsers = await getTopUsers(10);
    await showTopUsersMenu(bot, chatId, topUsers);
  } catch (error) {
    console.error('❌ Ошибка топа:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить топ');
  }
}

// ================= СЕРВЕР И ПРОВЕРКИ =================
app.get('/api/bot', (req, res) => {
  res.json({ 
    status: 'online',
    bot: 'Telegram Sticker Bot',
    time: new Date().toISOString(),
    env: {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasDb: !!process.env.NEON_DATABASE_URL
    }
  });
});

app.get('/api/check-env', (req, res) => {
  res.json({
    status: 'check',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Отсутствует',
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL ? '✅ Установлен' : '❌ Отсутствует',
    VERCEL_URL: process.env.VERCEL_URL || 'Не установлен',
    NODE_ENV: process.env.NODE_ENV || 'production'
  });
});

app.get('/api/version', (req, res) => {
  res.json({
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Бот запущен на порту ${PORT}`);
  console.log(`🌐 Webhook: ${process.env.VERCEL_URL}/api/bot`);
});

module.exports = app;
