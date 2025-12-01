const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { processImage, addText, addFrame, addPearlEffect } = require('../lib/imageProcessor');
const { 
  initDatabase, 
  saveSticker, 
  getUserStickers,
  createFolder,
  getFolders,
  deleteFolder,
  deleteSticker,
  updateStats,
  getStats,
  getUser
} = require('../lib/database');

// ИМПОРТ МЕНЮ
const {
  showMainMenu,
  showEffectsMenu,
  showFoldersMenu,
  showStickersMenu,
  showSettingsMenu,
  showHelpMenu,
  showStatsMenu,
  showFavoritesMenu,
  showCreateFolderMenu,
  showDeleteMenu,
  showTextMenu,
  showColorMenu
} = require('./menu');

const app = express();
app.use(express.json());

// Проверка переменных
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.NEON_DATABASE_URL) {
  console.error('❌ Отсутствуют переменные окружения!');
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

// Установка команд
bot.setMyCommands([
  { command: 'start', description: 'Запустить бота' },
  { command: 'menu', description: 'Главное меню' },
  { command: 'help', description: 'Помощь' }
]);

// Инициализация БД
initDatabase();

// Хранилище сессий
const userSessions = {};

// ================= ОБРАБОТКА СООБЩЕНИЙ =================
app.post('/api/bot', async (req, res) => {
  try {
    const update = req.body;

    // Сообщения
    if (update.message) {
      const chatId = update.message.chat.id;
      const userId = update.message.from.id;
      const messageText = update.message.text;
      const username = update.message.from.username || update.message.from.first_name;

      console.log(`📨 От ${username}: ${messageText || 'фото'}`);

      // Регистрация пользователя
      await getUser(userId, username);

      // Обработка текстовых сообщений
      if (messageText) {
        await handleTextMessage(chatId, userId, messageText);
      }

      // Обработка фото
      if (update.message.photo) {
        await handlePhotoMessage(chatId, userId, update.message.photo);
      }

      // Обработка документов (PNG)
      if (update.message.document) {
        await handleDocumentMessage(chatId, userId, update.message.document);
      }
    }

    // Callback запросы (нажатия кнопок)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ================= ТЕКСТОВЫЕ СООБЩЕНИЯ =================
async function handleTextMessage(chatId, userId, text) {
  switch (text) {
    case '/start':
      await bot.sendMessage(chatId, `✨ *Добро пожаловать!* ✨\n\n` +
        `Я бот для создания стикеров с эффектами!\n` +
        `Отправьте мне фото или используйте меню.`, { parse_mode: 'Markdown' });
      await showMainMenu(bot, chatId);
      break;

    case '/menu':
    case 'меню':
    case 'Меню':
      await showMainMenu(bot, chatId);
      break;

    case '🎨 Создать стикер':
      await bot.sendMessage(chatId, '📸 *Отправьте мне фото или PNG-изображение*\n\n' +
        'Я обрежу его в квадрат и добавлю эффекты!', { parse_mode: 'Markdown' });
      userSessions[userId] = { state: 'awaiting_image' };
      break;

    case '📁 Мои стикеры':
      await showUserStickers(chatId, userId);
      break;

    case '📂 Папки':
      await showUserFolders(chatId, userId);
      break;

    case '⭐ Избранное':
      await showFavorites(bot, chatId, userId);
      break;

    case '📊 Статистика':
      await showUserStatistics(chatId, userId);
      break;

    case '⚙️ Настройки':
      await showSettingsMenu(bot, chatId);
      break;

    case 'ℹ️ Помощь':
      await showHelpMenu(bot, chatId);
      break;

    case '👥 Топ пользователей':
      await showTopUsers(chatId);
      break;

    case '/help':
      await showHelp(bot, chatId);
      break;

    default:
      // Обработка текста для стикера
      if (userSessions[userId]?.state === 'awaiting_text') {
        userSessions[userId].text = text;
        await bot.sendMessage(chatId, `✅ Текст добавлен: "${text}"`);
        await showEffectsMenu(bot, chatId);
      }
      // Обработка названия папки
      else if (userSessions[userId]?.state === 'awaiting_folder_name') {
        await createUserFolder(chatId, userId, text);
      }
      else {
        await bot.sendMessage(chatId, 'Используйте меню или отправьте фото для создания стикера 🎨');
      }
  }
}

// ================= CALLBACK ЗАПРОСЫ =================
async function handleCallbackQuery(callback) {
  const chatId = callback.message.chat.id;
  const userId = callback.from.id;
  const data = callback.data;

  console.log(`🔄 Callback: ${data} от ${userId}`);

  try {
    // Обработка основных действий
    switch (data) {
      // Эффекты
      case 'effect_text':
        await bot.sendMessage(chatId, '✏️ *Введите текст для стикера:*', { parse_mode: 'Markdown' });
        userSessions[userId] = { ...userSessions[userId], state: 'awaiting_text' };
        break;

      case 'effect_frame':
        await showColorMenu(bot, chatId);
        userSessions[userId] = { ...userSessions[userId], selectedEffect: 'frame' };
        break;

      case 'effect_pearl':
        await processStickerWithEffect(chatId, userId, 'pearl');
        break;

      case 'effect_gradient':
        await processStickerWithEffect(chatId, userId, 'gradient');
        break;

      case 'effect_none':
        await processStickerWithEffect(chatId, userId, 'none');
        break;

      case 'effect_finish':
        await finishStickerCreation(chatId, userId);
        break;

      // Цвета рамки
      case 'color_white':
      case 'color_black':
      case 'color_red':
      case 'color_blue':
      case 'color_green':
      case 'color_yellow':
      case 'color_purple':
      case 'color_orange':
      case 'color_pink':
      case 'color_gold':
      case 'color_silver':
      case 'color_gradient':
        const color = data.replace('color_', '');
        userSessions[userId] = { 
          ...userSessions[userId], 
          frameColor: color,
          selectedEffect: 'frame'
        };
        await bot.sendMessage(chatId, `✅ Цвет рамки: ${color}`);
        await showEffectsMenu(bot, chatId);
        break;

      // Папки
      case 'create_folder':
        await bot.sendMessage(chatId, '📝 *Введите название для новой папки:*', { parse_mode: 'Markdown' });
        userSessions[userId] = { state: 'awaiting_folder_name' };
        break;

      case 'delete_folder':
        await showDeleteMenu(bot, chatId, 'folder');
        break;

      // Навигация
      case 'back_to_menu':
        await showMainMenu(bot, chatId);
        break;

      case 'cancel':
        delete userSessions[userId];
        await bot.sendMessage(chatId, '❌ Действие отменено');
        await showMainMenu(bot, chatId);
        break;

      // Статистика
      case 'stats_refresh':
        await showUserStatistics(chatId, userId);
        break;

      case 'stats_top':
        await showTopUsers(chatId);
        break;

      // Помощь
      case 'help_create':
        await bot.sendMessage(chatId, '📖 *Как создать стикер:*\n\n' +
          '1. Нажмите "🎨 Создать стикер"\n' +
          '2. Отправьте фото или PNG\n' +
          '3. Выберите эффекты\n' +
          '4. Получите готовый стикер!', { parse_mode: 'Markdown' });
        break;

      case 'help_support':
        await bot.sendMessage(chatId, '📞 *Поддержка:*\n\n' +
          'По вопросам и предложениям:\n' +
          '@ваш_администратор\n\n' +
          'Мы всегда рады помочь! ✨', { parse_mode: 'Markdown' });
        break;

      // Удаление
      case 'delete_sticker_confirm':
        await deleteStickerById(chatId, userId);
        break;

      case 'delete_folder_confirm':
        await deleteUserFolder(chatId, userId);
        break;

      // Другие действия
      default:
        // Обработка папок (folder_123)
        if (data.startsWith('folder_')) {
          const folderId = data.split('_')[1];
          await showFolderStickers(chatId, userId, folderId);
        }
        // Обработка стикеров (sticker_123)
        else if (data.startsWith('sticker_')) {
          const stickerId = data.split('_')[1];
          await showStickerActions(chatId, userId, stickerId);
        }
    }

    // Ответ на callback
    await bot.answerCallbackQuery(callback.id);
  } catch (error) {
    console.error('❌ Ошибка обработки callback:', error);
    await bot.answerCallbackQuery(callback.id, { text: '❌ Ошибка обработки' });
  }
}

// ================= ОСНОВНЫЕ ФУНКЦИИ =================

// Обработка фото
async function handlePhotoMessage(chatId, userId, photoArray) {
  if (userSessions[userId]?.state !== 'awaiting_image') {
    await bot.sendMessage(chatId, '📸 Получено фото! Нажмите "🎨 Создать стикер" в меню для обработки.');
    return;
  }

  try {
    await bot.sendMessage(chatId, '🔄 *Обрабатываю изображение...*', { parse_mode: 'Markdown' });

    const fileId = photoArray[photoArray.length - 1].file_id;
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    userSessions[userId] = {
      ...userSessions[userId],
      state: 'awaiting_effects',
      imageUrl: fileUrl,
      fileId: fileId
    };

    await showEffectsMenu(bot, chatId);
  } catch (error) {
    console.error('❌ Ошибка загрузки фото:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить фото');
  }
}

// Обработка документов
async function handleDocumentMessage(chatId, userId, document) {
  if (!['image/png', 'image/jpeg'].includes(document.mime_type)) {
    await bot.sendMessage(chatId, '❌ Пожалуйста, отправьте PNG или JPG изображение');
    return;
  }

  if (userSessions[userId]?.state !== 'awaiting_image') {
    await bot.sendMessage(chatId, '📎 Получен файл! Нажмите "🎨 Создать стикер" в меню для обработки.');
    return;
  }

  try {
    await bot.sendMessage(chatId, '🔄 *Обрабатываю изображение...*', { parse_mode: 'Markdown' });

    const file = await bot.getFile(document.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    userSessions[userId] = {
      ...userSessions[userId],
      state: 'awaiting_effects',
      imageUrl: fileUrl,
      fileId: document.file_id
    };

    await showEffectsMenu(bot, chatId);
  } catch (error) {
    console.error('❌ Ошибка загрузки документа:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить файл');
  }
}

// Создание стикера с эффектом
async function processStickerWithEffect(chatId, userId, effectType) {
  try {
    const session = userSessions[userId];
    if (!session?.imageUrl) {
      await bot.sendMessage(chatId, '❌ Изображение не найдено. Начните заново.');
      return;
    }

    await bot.sendMessage(chatId, '🎨 *Создаю стикер...*', { parse_mode: 'Markdown' });

    // Обработка изображения
    let imageBuffer = await processImage(session.imageUrl);

    // Применение текста
    if (session.text) {
      imageBuffer = await addText(imageBuffer, session.text);
    }

    // Применение эффектов
    if (effectType === 'frame') {
      const color = session.frameColor || 'white';
      imageBuffer = await addFrame(imageBuffer, color);
    } else if (effectType === 'pearl') {
      imageBuffer = await addPearlEffect(imageBuffer);
    } else if (effectType === 'gradient') {
      // Добавьте функцию для градиента в imageProcessor.js
      imageBuffer = await addPearlEffect(imageBuffer); // временно используем перламутр
    }

    // Сохранение стикера
    const stickerId = await saveSticker(userId, imageBuffer, effectType, session.text || '');

    // Обновление статистики
    await updateStats(userId);

    // Отправка результата
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: `✅ *Стикер создан!*\n\n` +
        `ID: #${stickerId}\n` +
        `Эффект: ${effectType}\n` +
        `${session.text ? `Текст: "${session.text}"` : ''}\n\n` +
        `💾 Стикер сохранен в вашу коллекцию!`,
      parse_mode: 'Markdown'
    });

    // Очистка сессии
    delete userSessions[userId];

    // Предложение дальнейших действий
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📁 Сохранить в папку', callback_data: 'save_to_folder' },
          { text: '⭐ Добавить в избранное', callback_data: 'add_to_favorites' }
        ],
        [
          { text: '🎨 Создать еще', callback_data: 'create_another' },
          { text: '📋 В меню', callback_data: 'back_to_menu' }
        ]
      ]
    };

    await bot.sendMessage(chatId, 'Что дальше?', { reply_markup: keyboard });

  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании стикера. Попробуйте еще раз.');
  }
}

// Завершение создания стикера
async function finishStickerCreation(chatId, userId) {
  const session = userSessions[userId];
  const effectType = session?.selectedEffect || 'none';
  await processStickerWithEffect(chatId, userId, effectType);
}

// Показать стикеры пользователя
async function showUserStickers(chatId, userId) {
  try {
    const stickers = await getUserStickers(userId);
    await showStickersMenu(bot, chatId, stickers);
  } catch (error) {
    console.error('❌ Ошибка загрузки стикеров:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить стикеры');
  }
}

// Показать папки пользователя
async function showUserFolders(chatId, userId) {
  try {
    const folders = await getFolders(userId);
    await showFoldersMenu(bot, chatId, folders);
  } catch (error) {
    console.error('❌ Ошибка загрузки папок:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить папки');
  }
}

// Создать папку
async function createUserFolder(chatId, userId, folderName) {
  try {
    if (!folderName || folderName.trim().length === 0) {
      await bot.sendMessage(chatId, '❌ Название папки не может быть пустым');
      return;
    }

    if (folderName.length > 50) {
      await bot.sendMessage(chatId, '❌ Название слишком длинное (макс. 50 символов)');
      return;
    }

    const folder = await createFolder(userId, folderName);
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📂 Открыть папку', callback_data: `folder_${folder.id}` },
          { text: '➕ Добавить стикеры', callback_data: `add_to_folder_${folder.id}` }
        ],
        [
          { text: '🔙 К папкам', callback_data: 'show_folders' }
        ]
      ]
    };

    await bot.sendMessage(chatId, `✅ *Папка создана!*\n\n"${folderName}"`, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });

    delete userSessions[userId];
  } catch (error) {
    console.error('❌ Ошибка создания папки:', error);
    await bot.sendMessage(chatId, '❌ Не удалось создать папку');
  }
}

// Показать статистику
async function showUserStatistics(chatId, userId) {
  try {
    const stats = await getStats(userId);
    await showStatsMenu(bot, chatId, stats);
  } catch (error) {
    console.error('❌ Ошибка статистики:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить статистику');
  }
}

// Показать топ пользователей
async function showTopUsers(chatId) {
  const { sql } = require('../lib/database');
  
  try {
    const topUsers = await sql`
      SELECT username, stickers_count, rating
      FROM users
      ORDER BY stickers_count DESC, rating DESC
      LIMIT 10
    `;

    let message = '🏆 *Топ пользователей:*\n\n';
    
    if (topUsers.length === 0) {
      message += 'Пока нет данных о пользователях';
    } else {
      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        message += `${medal} ${user.username || 'Аноним'}\n`;
        message += `   🎨 ${user.stickers_count} стикеров | ⭐ ${user.rating}/10\n\n`;
      });
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('❌ Ошибка топа:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить топ');
  }
}

// Показать избранное
async function showFavorites(bot, chatId, userId) {
  // Здесь можно реализовать логику избранного
  await showFavoritesMenu(bot, chatId, []);
}

// Помощь
async function showHelp(bot, chatId) {
  const helpText = `🎨 *Помощь по боту*\n\n` +
    `*Основные команды:*\n` +
    `/start - Запустить бота\n` +
    `/menu - Главное меню\n\n` +
    `*Как работать:*\n` +
    `1. Используйте кнопочное меню\n` +
    `2. Отправьте фото для создания стикера\n` +
    `3. Выбирайте эффекты и настройки\n` +
    `4. Сохраняйте и делитесь!\n\n` +
    `*Что умеет бот:*\n` +
    `• Создавать стикеры из фото\n` +
    `• Добавлять текст и эффекты\n` +
    `• Хранить стикеры в папках\n` +
    `• Показывать статистику\n\n` +
    `📞 Поддержка: @ваш_админ`;

  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ================= СЕРВЕР =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Бот запущен на порту ${PORT}`);
  console.log(`🌐 Webhook: ${process.env.VERCEL_URL}/api/bot`);
});

app.get('/api/bot', (req, res) => {
  res.json({ 
    status: 'online',
    bot: 'Telegram Sticker Bot',
    menu: 'Кнопочное меню активировано'
  });
});

module.exports = app;
