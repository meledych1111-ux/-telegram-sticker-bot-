const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { processImage, addText, addFrame, addPearlEffect } = require('../lib/imageProcessor');
const { 
  initDatabase, 
  saveSticker, 
  getUserStickers,
  deleteSticker,
  createFolder,
  getFolders,
  deleteFolder,
  updateStats,
  getStats,
  getUser
} = require('../lib/database');

const app = express();
app.use(express.json());

// ================= ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ =================
console.log('🔧 Проверка переменных окружения...');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Отсутствует');
console.log('NEON_DATABASE_URL:', process.env.NEON_DATABASE_URL ? '✅ Установлен' : '❌ Отсутствует');
console.log('VERCEL_URL:', process.env.VERCEL_URL || '⚠️  Не установлен');

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ ОШИБКА: TELEGRAM_BOT_TOKEN не найден!');
  console.log('ℹ️ Добавьте в Vercel → Settings → Environment Variables');
}

if (!process.env.NEON_DATABASE_URL) {
  console.error('❌ ОШИБКА: NEON_DATABASE_URL не найден!');
  console.log('ℹ️ Добавьте строку подключения от Neon');
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token);

// Инициализация базы данных
initDatabase().then(() => {
  console.log('✅ База данных инициализирована');
}).catch(err => {
  console.error('❌ Ошибка инициализации БД:', err);
});

// Хранилище сессий пользователей
const userSessions = {};

// ================= КОМАНДЫ БОТА =================
app.post('/api/bot', async (req, res) => {
  try {
    const update = req.body;
    
    // Обработка сообщений
    if (update.message) {
      const chatId = update.message.chat.id;
      const messageText = update.message.text;
      const userId = update.message.from.id;
      const username = update.message.from.username || update.message.from.first_name;

      console.log(`📨 Сообщение от ${username} (${userId}): ${messageText || 'фото/документ'}`);

      // Регистрация/получение пользователя
      await getUser(userId, username);

      // Обработка текстовых команд
      if (messageText) {
        switch (messageText) {
          case '/start':
            await sendWelcome(chatId, username);
            await showMainMenu(chatId);
            break;
            
          case '/menu':
          case '📋 Меню':
            await showMainMenu(chatId);
            break;
            
          case '/newsticker':
          case '🎨 Новый стикер':
            await bot.sendMessage(chatId, '📸 Отправьте мне изображение (JPG или PNG):');
            userSessions[userId] = { state: 'awaiting_image' };
            break;
            
          case '/mystickers':
          case '📁 Мои стикеры':
            await showMyStickers(chatId, userId);
            break;
            
          case '/folders':
          case '📂 Папки':
            await showFolders(chatId, userId);
            break;
            
          case '/stats':
          case '📊 Статистика':
            await showUserStats(chatId, userId);
            break;
            
          case '/help':
          case 'ℹ️ Помощь':
            await showHelp(chatId);
            break;
            
          case '🚫 Отмена':
            delete userSessions[userId];
            await bot.sendMessage(chatId, '❌ Действие отменено');
            await showMainMenu(chatId);
            break;
            
          default:
            // Обработка текста для стикера
            if (userSessions[userId]?.state === 'awaiting_text') {
              userSessions[userId].text = messageText;
              await bot.sendMessage(chatId, `✅ Текст добавлен: "${messageText}"\nТеперь выберите эффекты:`);
              await showEffectsMenu(chatId);
            }
            // Обработка названия папки
            else if (userSessions[userId]?.state === 'awaiting_folder_name') {
              const folderName = messageText.substring(0, 50);
              const folder = await createFolder(userId, folderName);
              await bot.sendMessage(chatId, `✅ Папка создана: "${folderName}"`);
              delete userSessions[userId];
              await showFolders(chatId, userId);
            }
        }
      }

      // Обработка фото
      if (update.message.photo && userSessions[userId]?.state === 'awaiting_image') {
        const photo = update.message.photo[update.message.photo.length - 1];
        await handleImageUpload(chatId, userId, photo.file_id);
      }

      // Обработка документов (PNG)
      if (update.message.document && userSessions[userId]?.state === 'awaiting_image') {
        const doc = update.message.document;
        if (doc.mime_type === 'image/png' || doc.mime_type === 'image/jpeg') {
          await handleImageUpload(chatId, userId, doc.file_id);
        } else {
          await bot.sendMessage(chatId, '❌ Пожалуйста, отправьте изображение в формате JPG или PNG');
        }
      }
    }

    // Обработка callback_query (нажатия кнопок)
    if (update.callback_query) {
      const data = update.callback_query.data;
      const chatId = update.callback_query.message.chat.id;
      const userId = update.callback_query.from.id;
      
      console.log(`🔄 Callback: ${data} от ${userId}`);
      
      if (data === 'effect_text') {
        await bot.sendMessage(chatId, '✏️ Введите текст для стикера:');
        userSessions[userId] = { ...userSessions[userId], state: 'awaiting_text' };
      }
      else if (data === 'effect_frame') {
        await applyEffectAndFinish(chatId, userId, 'frame');
      }
      else if (data === 'effect_pearl') {
        await applyEffectAndFinish(chatId, userId, 'pearl');
      }
      else if (data === 'effect_none') {
        await applyEffectAndFinish(chatId, userId, 'none');
      }
      else if (data === 'create_folder') {
        await bot.sendMessage(chatId, '📝 Введите название для новой папки:');
        userSessions[userId] = { state: 'awaiting_folder_name' };
      }
      else if (data === 'list_folders') {
        await showUserFolders(chatId, userId);
      }
      
      await bot.answerCallbackQuery(update.callback_query.id);
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Ошибка в обработчике:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ================= ФУНКЦИИ БОТА =================

// Приветственное сообщение
async function sendWelcome(chatId, username) {
  const welcome = `👋 *Привет, ${username}!*\n\n` +
    `🎨 Я — бот для создания стикеров!\n\n` +
    `*Что я умею:*\n` +
    `• Создавать стикеры из фото\n` +
    `• Добавлять текст и эффекты\n` +
    `• Хранить ваши стикеры\n` +
    `• Сортировать по папкам\n` +
    `• Показывать статистику\n\n` +
    `📱 Используйте меню ниже для навигации.`;
  
  await bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
}

// Главное меню
async function showMainMenu(chatId) {
  const menu = {
    reply_markup: {
      keyboard: [
        ['🎨 Новый стикер', '📁 Мои стикеры'],
        ['📂 Папки', '📊 Статистика'],
        ['ℹ️ Помощь', '📋 Меню']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
  
  await bot.sendMessage(chatId, '📱 *Главное меню:*\nВыберите действие:', { 
    parse_mode: 'Markdown',
    ...menu 
  });
}

// Загрузка изображения
async function handleImageUpload(chatId, userId, fileId) {
  try {
    await bot.sendMessage(chatId, '⏳ Обрабатываю изображение...');
    
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    
    userSessions[userId] = {
      state: 'awaiting_effects',
      imageUrl: fileUrl
    };
    
    await showEffectsMenu(chatId);
    
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить изображение');
  }
}

// Меню эффектов
async function showEffectsMenu(chatId) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📝 Добавить текст', callback_data: 'effect_text' },
        { text: '🖼️ Рамка', callback_data: 'effect_frame' }
      ],
      [
        { text: '✨ Перламутр', callback_data: 'effect_pearl' },
        { text: '✅ Без эффектов', callback_data: 'effect_none' }
      ],
      [
        { text: '🚫 Отмена', callback_data: 'effect_cancel' }
      ]
    ]
  };
  
  await bot.sendMessage(chatId, '🎭 *Выберите эффекты для стикера:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// Применение эффектов и сохранение
async function applyEffectAndFinish(chatId, userId, effectType) {
  try {
    const session = userSessions[userId];
    if (!session?.imageUrl) {
      await bot.sendMessage(chatId, '❌ Изображение не найдено. Начните заново.');
      return;
    }
    
    await bot.sendMessage(chatId, '🎨 Создаю стикер...');
    
    // Обработка изображения
    let imageBuffer = await processImage(session.imageUrl);
    
    // Применение эффектов
    if (session.text) {
      imageBuffer = await addText(imageBuffer, session.text);
    }
    
    if (effectType === 'frame') {
      imageBuffer = await addFrame(imageBuffer);
    } else if (effectType === 'pearl') {
      imageBuffer = await addPearlEffect(imageBuffer);
    }
    
    // Сохранение в БД
    const stickerId = await saveSticker(userId, imageBuffer, effectType, session?.text || '');
    
    // Обновление статистики
    await updateStats(userId);
    
    // Отправка результата
    await bot.sendPhoto(chatId, imageBuffer, {
      caption: `✅ *Стикер создан!*\nID: ${stickerId}\nЭффект: ${effectType}`,
      parse_mode: 'Markdown'
    });
    
    // Очистка сессии
    delete userSessions[userId];
    
    await showMainMenu(chatId);
    
  } catch (error) {
    console.error('Ошибка создания стикера:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при создании стикера');
  }
}

// Показать мои стикеры
async function showMyStickers(chatId, userId) {
  try {
    const stickers = await getUserStickers(userId);
    
    if (stickers.length === 0) {
      await bot.sendMessage(chatId, '📭 У вас пока нет стикеров.\nСоздайте первый через "🎨 Новый стикер"');
      return;
    }
    
    await bot.sendMessage(chatId, `📚 *Ваши стикеры:* (${stickers.length} шт.)`, {
      parse_mode: 'Markdown'
    });
    
    // Отправляем первые 5 стикеров
    for (let i = 0; i < Math.min(5, stickers.length); i++) {
      await bot.sendPhoto(chatId, stickers[i].image_data, {
        caption: `Стикер #${stickers[i].id}\n${new Date(stickers[i].created_at).toLocaleDateString('ru-RU')}`
      });
    }
    
    if (stickers.length > 5) {
      await bot.sendMessage(chatId, `... и еще ${stickers.length - 5} стикеров`);
    }
    
  } catch (error) {
    console.error('Ошибка загрузки стикеров:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке стикеров');
  }
}

// Управление папками
async function showFolders(chatId, userId) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '➕ Создать папку', callback_data: 'create_folder' }],
      [{ text: '📁 Мои папки', callback_data: 'list_folders' }],
      [{ text: '🔙 Назад', callback_data: 'back_to_menu' }]
    ]
  };
  
  await bot.sendMessage(chatId, '📂 *Управление папками:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// Показать папки пользователя
async function showUserFolders(chatId, userId) {
  try {
    const folders = await getFolders(userId);
    
    if (folders.length === 0) {
      await bot.sendMessage(chatId, '📭 У вас пока нет папок.');
      return;
    }
    
    let message = '📂 *Ваши папки:*\n\n';
    folders.forEach((folder, index) => {
      message += `${index + 1}. ${folder.name}\n`;
    });
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Ошибка загрузки папок:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке папок');
  }
}

// Статистика пользователя
async function showUserStats(chatId, userId) {
  try {
    const stats = await getStats(userId);
    
    const statsMessage = `📊 *Ваша статистика:*\n\n` +
      `👤 Имя: ${stats.username}\n` +
      `🎨 Стикеров: ${stats.stickers_count}\n` +
      `⭐ Рейтинг: ${stats.rating}/10\n` +
      `📅 Создан: ${new Date(stats.created_at).toLocaleDateString('ru-RU')}`;
    
    await bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Ошибка статистики:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при загрузке статистики');
  }
}

// Помощь
async function showHelp(chatId) {
  const helpText = `❓ *Помощь по боту*\n\n` +
    `*Основные команды:*\n` +
    `/start - Запустить бота\n` +
    `/menu - Главное меню\n` +
    `/newsticker - Создать стикер\n` +
    `/mystickers - Мои стикеры\n` +
    `/folders - Управление папками\n` +
    `/stats - Статистика\n\n` +
    `*Как создать стикер:*\n` +
    `1. Нажмите "🎨 Новый стикер"\n` +
    `2. Отправьте фото (JPG/PNG)\n` +
    `3. Выберите эффекты\n` +
    `4. Получите готовый стикер!\n\n` +
    `📞 Поддержка: @ваш_админ`;
  
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// ================= API ЭНДПОИНТЫ =================
app.get('/api/bot', (req, res) => {
  res.json({
    status: 'online',
    bot: 'Telegram Sticker Bot',
    time: new Date().toISOString(),
    env: {
      hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasDb: !!process.env.NEON_DATABASE_URL,
      vercelUrl: process.env.VERCEL_URL
    }
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sticker Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .status { padding: 20px; margin: 20px; border-radius: 10px; }
        .online { background: #d4edda; color: #155724; }
        .offline { background: #f8d7da; color: #721c24; }
        .btn { display: inline-block; padding: 10px 20px; margin: 10px; 
               background: #007bff; color: white; text-decoration: none; 
               border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>🎨 Telegram Sticker Bot</h1>
      <div class="status online">
        <h2>✅ Бот работает!</h2>
        <p>Статус: Online</p>
        <p>Время: ${new Date().toLocaleString()}</p>
      </div>
      <p>
        <a href="https://t.me/${bot.options.username}" class="btn" target="_blank">📱 Открыть бота</a>
        <a href="/api/check-env" class="btn">🔧 Проверить настройки</a>
      </p>
    </body>
    </html>
  `);
});

// ================= ЗАПУСК СЕРВЕРА =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Webhook URL: ${process.env.VERCEL_URL}/api/bot`);
  console.log(`🤖 Бот: @${bot.options.username || 'неизвестно'}`);
});

module.exports = app;
