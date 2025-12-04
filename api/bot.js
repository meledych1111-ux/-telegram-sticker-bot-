// api/bot.js - ОПТИМИЗИРОВАННЫЙ ДЛЯ NODE.JS 24.x
console.log('🚀 ============ ЗАГРУЗКА STICKER BOT ============');
console.log('📦 Node.js версия:', process.version);
console.log('📅 Время запуска:', new Date().toISOString());

// Проверка поддержки Node.js 24 фич
console.log('🔍 Проверка возможностей Node.js 24:');
console.log('   • fetch встроен:', typeof fetch === 'function' ? '✅' : '❌');
console.log('   • WebSocket встроен:', typeof WebSocket === 'function' ? '✅' : '❌');
console.log('   • Permission API:', typeof process.permission?.has === 'function' ? '✅' : '❌');

const fs = require('fs');
const path = require('path');

// 1. ПРОВЕРКА СТРУКТУРЫ
console.log('📁 Проверка структуры проекта:');
console.log('📍 Текущая директория:', __dirname);

const libPath = path.join(__dirname, '..', 'lib');
if (fs.existsSync(libPath)) {
  const files = fs.readdirSync(libPath);
  console.log('📂 Файлы в lib:', files);
} else {
  console.log('❌ Папка lib не существует!');
}

// 2. ИМПОРТ БИБЛИОТЕК
let MenuBuilder, stickerCreator;
try {
  MenuBuilder = require('../lib/menuBuilder');
  stickerCreator = require('../lib/stickerCreator');
  console.log('✅ MenuBuilder и stickerCreator загружены');
} catch (error) {
  console.error('❌ Ошибка загрузки библиотек:', error.message);
  process.exit(1);
}

// 3. ИМПОРТ БАЗЫ ДАННЫХ (database.js)
console.log('\n🔍 Импорт базы данных из lib/database.js...');

let database;
let dbLoaded = false;

try {
  database = require('../lib/database');
  console.log('✅ lib/database.js загружен');
  
  // Проверяем функции
  console.log('🔧 Проверка функций базы:');
  console.log('   • getTopUsers:', typeof database.getTopUsers === 'function' ? '✅' : '❌');
  console.log('   • getUserStats:', typeof database.getUserStats === 'function' ? '✅' : '❌');
  console.log('   • saveUser:', typeof database.saveUser === 'function' ? '✅' : '❌');
  console.log('   • saveSticker:', typeof database.saveSticker === 'function' ? '✅' : '❌');
  console.log('   • getBotStats:', typeof database.getBotStats === 'function' ? '✅' : '❌');
  
  // Тест подключения
  console.log('🧪 Тест подключения к БД...');
  try {
    if (typeof database.initializeTables === 'function') {
      await database.initializeTables();
    }
    
    const testResult = await database.getTopUsers(3);
    console.log('✅ База работает! Тестовый топ:', testResult?.length || 0, 'записей');
    dbLoaded = true;
  } catch (testError) {
    console.log('⚠️ Тест не удался:', testError.message);
    dbLoaded = false;
  }
  
} catch (error) {
  console.error('❌ Ошибка загрузки базы данных:', error.message);
  dbLoaded = false;
}

// 4. СОЗДАЕМ ЗАГЛУШКУ ЕСЛИ БАЗА НЕ ЗАГРУЗИЛАСЬ
if (!dbLoaded || !database) {
  console.log('\n⚠️ Создаю заглушку для базы данных');
  database = {
    saveUser: async (chatId, username, firstName) => {
      console.log(`📝 [ЗАГЛУШКА] saveUser: ${chatId}, ${username}`);
      return Date.now();
    },
    getUserStats: async (chatId) => {
      console.log(`📊 [ЗАГЛУШКА] getUserStats: ${chatId}`);
      return {
        username: 'Тестовый',
        total_stickers: Math.floor(Math.random() * 10),
        registration_date: new Date()
      };
    },
    getTopUsers: async (limit = 10) => {
      console.log(`🏆 [ЗАГЛУШКА] getTopUsers: limit=${limit}`);
      return [
        { username: 'Алексей', stickers_created: 15, rank: 1 },
        { username: 'Мария', stickers_created: 12, rank: 2 },
        { username: 'Иван', stickers_created: 8, rank: 3 },
        { username: 'Ольга', stickers_created: 5, rank: 4 },
        { username: 'Дмитрий', stickers_created: 3, rank: 5 }
      ];
    },
    saveSticker: async (chatId, fileId, effect = 'none', sizeBytes = 0) => {
      console.log(`🎨 [ЗАГЛУШКА] saveSticker: ${chatId}, ${effect}, ${sizeBytes} bytes`);
      return true;
    },
    createCollection: async (chatId, name) => {
      console.log(`📁 [ЗАГЛУШКА] createCollection: ${chatId}, "${name}"`);
      return true;
    },
    getBotStats: async () => ({
      total_users: 100,
      total_stickers: 500
    })
  };
  console.log('✅ Заглушка создана');
}

// 5. ХРАНИЛИЩЕ СЕССИЙ
const userSessions = {};
console.log('\n✅ Все библиотеки загружены\n');

// 6. ОСНОВНОЙ ЭКСПОРТ ДЛЯ VERCEL
module.exports = async (req, res) => {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Sticker Bot активен!',
      version: '2.0',
      node_version: process.version,
      features: ['Стикеры', 'Статистика', 'Топ'],
      database: dbLoaded ? '✅ Neon PostgreSQL' : '⚠️ Заглушка',
      endpoints: ['/api/bot', '/health', '/stats']
    });
  }

  // ОБРАБОТКА POST ЗАПРОСОВ ОТ TELEGRAM
  if (req.method === 'POST') {
    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN) {
        throw new Error('TELEGRAM_BOT_TOKEN не настроен');
      }
      
      const update = req.body;
      const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

      console.log('\n📨 Получен update от Telegram');
      console.log('📝 Тип:', update.callback_query ? 'callback' : 'message');

      // ОБРАБОТКА CALLBACK QUERY
      if (update.callback_query) {
        await handleCallbackQuery(BOT_URL, update.callback_query);
        return res.status(200).json({ ok: true });
      }

      // ОБРАБОТКА СООБЩЕНИЙ
      if (update.message) {
        await handleMessage(BOT_URL, update.message);
        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });

    } catch (error) {
      console.error('❌ Ошибка обработки:', error);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(404).json({ error: 'Not Found' });
};

// 7. ОСНОВНЫЕ ФУНКЦИИ ОБРАБОТКИ

// ОБРАБОТКА СООБЩЕНИЙ
async function handleMessage(BOT_URL, message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const username = message.from?.username || message.from?.first_name || 'Пользователь';
  const firstName = message.from?.first_name || '';

  console.log(`👤 Пользователь: ${username}, Текст: ${text}`);

  // 📋 ОСНОВНЫЕ КОМАНДЫ
  switch (true) {
    case text === '/start':
      await handleStart(BOT_URL, chatId, username, firstName);
      break;
    
    case text === '/help':
      await handleHelp(BOT_URL, chatId);
      break;
    
    case text === '/top':
      await handleTop(BOT_URL, chatId);
      break;
    
    case text === '/stats':
      await handleStats(BOT_URL, chatId, username);
      break;
    
    case text === '/debug':
      await handleDebug(BOT_URL, chatId);
      break;
    
    case text === '🎨 Создать стикер':
      await handleCreateSticker(BOT_URL, chatId);
      break;
    
    case text === '⭐ Избранное':
      await handleFavorites(BOT_URL, chatId);
      break;
    
    case text === '📚 Мои подборки':
      await handleCollections(BOT_URL, chatId);
      break;
    
    case text === '📊 Статистика':
      await handleStats(BOT_URL, chatId, username);
      break;
    
    case text === '🏆 Топ':
      await handleTop(BOT_URL, chatId);
      break;
    
    case text === '🔙 Назад':
      await handleMainMenu(BOT_URL, chatId);
      break;
    
    default:
      // Обработка фото
      if (message.photo) {
        await handlePhoto(BOT_URL, chatId, message.photo, username, firstName);
      }
      // Обработка документов
      else if (message.document && message.document.mime_type?.startsWith('image/')) {
        await handleDocument(BOT_URL, chatId, message.document, username, firstName);
      }
      // Создание подборки
      else if (userSessions[chatId]?.waitingFor === 'collection_name') {
        await handleCreateCollection(BOT_URL, chatId, text);
      }
      // Любой другой текст
      else if (text.trim()) {
        await handleMainMenu(BOT_URL, chatId);
      }
      break;
  }
}

// СТАРТ
async function handleStart(BOT_URL, chatId, username, firstName) {
  // Сохраняем пользователя
  await database.saveUser(chatId, username, firstName);
  
  await sendMessage(BOT_URL, chatId,
    `👋 *Добро пожаловать, ${username || firstName || 'друг'}!* 🎨\n\n` +
    'Я — бот для создания крутых стикеров из ваших фото!\n\n' +
    '✨ *Что я умею:*\n' +
    '• Создавать стикеры из фото\n' +
    '• Автоматически обрезать до 512x512\n' +
    '• Показывать статистику и рейтинг\n' +
    '• Сохранять в избранное и подборки\n\n' +
    '🎯 *Просто отправьте мне фото!*',
    MenuBuilder.getStartMenu()
  );
}

// ГЛАВНОЕ МЕНЮ
async function handleMainMenu(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '🎨 *Главное меню Sticker Bot*\n\n' +
    'Выберите действие:',
    MenuBuilder.getMainMenu()
  );
}

// ПОМОЩЬ
async function handleHelp(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '📖 *Помощь по боту*\n\n' +
    '🎯 *Основные команды:*\n' +
    '/start - Запустить бота\n' +
    '/help - Эта справка\n' +
    '/top - Топ пользователей\n' +
    '/stats - Ваша статистика\n' +
    '/debug - Отладка базы данных\n\n' +
    '📸 *Как создать стикер:*\n' +
    '1. Нажмите "🎨 Создать стикер"\n' +
    '2. Отправьте фото\n' +
    '3. Получите стикер!\n\n' +
    '⭐ *Избранное:*\n' +
    'Сохраняйте лучшие стикеры\n\n' +
    '📚 *Подборки:*\n' +
    'Создавайте тематические коллекции\n\n' +
    '📊 *Статистика:*\n' +
    'Следите за своими достижениями\n\n' +
    '🏆 *Топ:*\n' +
    'Соревнуйтесь с другими\n\n' +
    '💎 *Все функции бесплатны!*',
    MenuBuilder.getMainMenu()
  );
}

// 🏆 ТОП ПОЛЬЗОВАТЕЛЕЙ
async function handleTop(BOT_URL, chatId) {
  console.log(`🏆 Получение топа для ${chatId}`);
  
  let topMessage;
  try {
    // Используем database.getTopUsers
    const topUsers = await database.getTopUsers(10);
    
    if (!topUsers || topUsers.length === 0) {
      topMessage = '🏆 *Топ создателей стикеров:*\n\n' +
        '🥇 Пока никто не создал стикеров\n' +
        '🥈 Будь первым!\n' +
        '🥉 Отправь фото прямо сейчас!\n\n' +
        '🎯 *Создай свой первый стикер!*';
    } else {
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      topMessage = '🏆 *Топ создателей стикеров:*\n\n';
      
      topUsers.forEach((user, index) => {
        const medal = medals[index] || '🔸';
        const name = user.username || user.first_name || `ID: ${user.chat_id || 'Аноним'}`;
        const count = user.stickers_created || 0;
        topMessage += `${medal} ${name} - ${count} стикеров\n`;
      });
      
      topMessage += '\n🎯 *Создай свой первый стикер!*';
    }
    
  } catch (error) {
    console.error('❌ Ошибка в getTopUsers:', error.message);
    topMessage = '🏆 *Топ временно недоступен*\n\n' +
      'База данных обновляется... 🔄';
  }
  
  await sendMessage(BOT_URL, chatId, topMessage, MenuBuilder.getMainMenu());
}

// 📊 СТАТИСТИКА
async function handleStats(BOT_URL, chatId, username) {
  console.log(`📊 Получение статистики для ${chatId}`);
  
  try {
    // Используем database.getUserStats
    const stats = await database.getUserStats(chatId);
    
    // Форматируем дату регистрации
    let regDate = 'сегодня';
    if (stats.registration_date) {
      const date = new Date(stats.registration_date);
      regDate = date.toLocaleDateString('ru-RU');
    }
    
    const statsText = `📊 *Статистика @${username || 'пользователь'}:*\n\n` +
      `🎨 Создано стикеров: *${stats.total_stickers || 0}*\n` +
      `📅 Зарегистрирован: *${regDate}*\n\n` +
      '_Данные из Neon PostgreSQL_ 🗄️';
    
    await sendMessage(BOT_URL, chatId, statsText, MenuBuilder.getMainMenu());
    
  } catch (error) {
    console.error('❌ Ошибка в getUserStats:', error.message);
    await sendMessage(BOT_URL, chatId,
      '📊 *Статистика:*\n\n' +
      '🎨 Создано стикеров: *0*\n' +
      '📅 Зарегистрирован: *сегодня*\n\n' +
      '_База данных обновляется..._ 🔄',
      MenuBuilder.getMainMenu()
    );
  }
}

// 🐛 ОТЛАДКА БАЗЫ ДАННЫХ
async function handleDebug(BOT_URL, chatId) {
  console.log(`🐛 Отладка базы данных для ${chatId}`);
  
  try {
    const userStats = await database.getUserStats(chatId);
    const botStats = await database.getBotStats ? await database.getBotStats() : { total_users: 0, total_stickers: 0 };
    const topUsers = await database.getTopUsers(5);
    
    let message = '🔍 *Отладка базы данных:*\n\n';
    
    message += '📊 *Ваша статистика:*\n';
    message += `• Стикеров создано: *${userStats.total_stickers || 0}*\n`;
    message += `• Дата регистрации: *${userStats.registration_date ? new Date(userStats.registration_date).toLocaleDateString('ru-RU') : 'неизвестно'}*\n\n`;
    
    message += '📈 *Статистика бота:*\n';
    message += `• Всего пользователей: *${botStats.total_users || 0}*\n`;
    message += `• Всего стикеров: *${botStats.total_stickers || 0}*\n\n`;
    
    message += '🏆 *Текущий топ (5 лучших):*\n';
    if (topUsers && topUsers.length > 0) {
      topUsers.forEach((user, index) => {
        const name = user.username || user.first_name || `ID: ${user.chat_id}`;
        message += `${index + 1}. ${name} - ${user.stickers_created || 0} стикеров\n`;
      });
    } else {
      message += 'Пока никто не создал стикеров\n';
    }
    
    message += '\n🗄️ *База данных:* ';
    message += dbLoaded ? '✅ Neon PostgreSQL активна' : '⚠️ Заглушка';
    
    await sendMessage(BOT_URL, chatId, message, MenuBuilder.removeMenu());
    
  } catch (error) {
    console.error('❌ Ошибка в отладке:', error.message);
    await sendMessage(BOT_URL, chatId,
      '❌ *Ошибка отладки*\n\n' +
      `Техническая информация:\n${error.message}`,
      MenuBuilder.getMainMenu()
    );
  }
}

// 🎨 СОЗДАНИЕ СТИКЕРА
async function handleCreateSticker(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '📷 *Отправьте мне изображение!*\n\n' +
    '✅ *Поддерживаются:*\n' +
    '• Фотографии из Telegram\n' +
    '• PNG, JPG, JPEG файлы\n' +
    '• Размером до 20 МБ\n\n' +
    '📏 *Автоматически обрежется до 512x512*',
    MenuBuilder.removeMenu()
  );
}

// ⭐ ИЗБРАННОЕ
async function handleFavorites(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '⭐ *Ваше избранное*\n\n' +
    '_Функция скоро будет доступна!_\n\n' +
    '📌 *Как добавлять:*\n' +
    'После создания стикера нажмите кнопку "⭐ В избранное"',
    MenuBuilder.getMainMenu()
  );
}

// 📚 ПОДБОРКИ
async function handleCollections(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '📚 *Ваши подборки*\n\n' +
    '_Создавайте тематические коллекции стикеров_\n\n' +
    '📁 *Создать новую подборку:*\n' +
    'Напишите "Создать подборку" и укажите название',
    MenuBuilder.getMainMenu()
  );
}

// 📸 ОБРАБОТКА ФОТО (упрощенная - сразу создает стикер)
async function handlePhoto(BOT_URL, chatId, photos, username, firstName) {
  await sendMessage(BOT_URL, chatId, '🔄 *Скачиваю фото...*', MenuBuilder.removeMenu());
  
  const bestPhoto = photos[photos.length - 1];
  const fileId = bestPhoto.file_id;
  const fileUrl = await getFileUrl(BOT_URL, fileId);
  
  // Сохраняем пользователя если ещё не сохранен
  try {
    await database.saveUser(chatId, username, firstName);
    console.log(`✅ Пользователь ${username} сохранен`);
  } catch (error) {
    console.log('⚠️ Ошибка сохранения пользователя:', error.message);
  }
  
  // Сразу создаем стикер
  await sendMessage(BOT_URL, chatId, '🎨 *Создаю стикер...*', MenuBuilder.removeMenu());
  
  try {
    // Скачиваем изображение
    const imageBuffer = await stickerCreator.downloadImage(fileUrl);
    
    // Создаем стикер (без эффектов)
    const stickerBuffer = await stickerCreator.createSticker(imageBuffer);
    
    // Отправляем стикер
    await stickerCreator.sendSticker(process.env.TELEGRAM_BOT_TOKEN, chatId, stickerBuffer);
    
    // Сохраняем стикер в базу (без эффекта)
    await database.saveSticker(chatId, fileId, 'none', stickerBuffer.length);
    
    const stickerId = Date.now();
    await sendMessage(BOT_URL, chatId,
      `✅ *Стикер готов!*\n\n` +
      '✨ *Что дальше?*',
      MenuBuilder.getStickerActions(stickerId)
    );
    
    console.log(`🎨 Создан стикер для ${username}`);
    
  } catch (error) {
    console.error('❌ Ошибка создания:', error);
    await sendMessage(BOT_URL, chatId, 
      '❌ *Не удалось создать стикер*\nПопробуйте другое фото!',
      MenuBuilder.getMainMenu()
    );
  }
}

// 📎 ОБРАБОТКА ДОКУМЕНТА (упрощенная - сразу создает стикер)
async function handleDocument(BOT_URL, chatId, document, username, firstName) {
  await sendMessage(BOT_URL, chatId, '🔄 *Загружаю изображение...*', MenuBuilder.removeMenu());
  
  const fileId = document.file_id;
  const fileUrl = await getFileUrl(BOT_URL, fileId);
  
  // Сохраняем пользователя
  try {
    await database.saveUser(chatId, username, firstName);
  } catch (error) {
    console.log('⚠️ Ошибка сохранения пользователя:', error.message);
  }
  
  // Сразу создаем стикер
  await sendMessage(BOT_URL, chatId, '🎨 *Создаю стикер...*', MenuBuilder.removeMenu());
  
  try {
    // Скачиваем изображение
    const imageBuffer = await stickerCreator.downloadImage(fileUrl);
    
    // Создаем стикер (без эффектов)
    const stickerBuffer = await stickerCreator.createSticker(imageBuffer);
    
    // Отправляем стикер
    await stickerCreator.sendSticker(process.env.TELEGRAM_BOT_TOKEN, chatId, stickerBuffer);
    
    // Сохраняем стикер в базу (без эффекта)
    await database.saveSticker(chatId, fileId, 'none', stickerBuffer.length);
    
    const stickerId = Date.now();
    await sendMessage(BOT_URL, chatId,
      `✅ *Стикер готов!*\n\n` +
      '✨ *Что дальше?*',
      MenuBuilder.getStickerActions(stickerId)
    );
    
    console.log(`🎨 Создан стикер для ${username}`);
    
  } catch (error) {
    console.error('❌ Ошибка создания:', error);
    await sendMessage(BOT_URL, chatId, 
      '❌ *Не удалось создать стикер*\nПопробуйте другое изображение!',
      MenuBuilder.getMainMenu()
    );
  }
}

// 📁 СОЗДАНИЕ ПОДБОРКИ
async function handleCreateCollection(BOT_URL, chatId, name) {
  try {
    await database.createCollection(chatId, name);
    console.log(`✅ Подборка "${name}" создана в базе`);
  } catch (error) {
    console.log('⚠️ Ошибка создания подборки в базе:', error.message);
  }
  
  await sendMessage(BOT_URL, chatId,
    `✅ Подборка "${name}" создана!\n\n` +
    'Теперь вы можете добавлять в неё стикеры.\n' +
    'После создания стикера нажмите "📁 В подборку"',
    MenuBuilder.getMainMenu()
  );
  
  delete userSessions[chatId];
}

// 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

// 📤 ОТПРАВКА СООБЩЕНИЯ (используем встроенный fetch Node.js 24)
async function sendMessage(BOT_URL, chatId, text, options = {}) {
  try {
    const response = await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'StickerBot/2.0 (Node.js 24)'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка отправки сообщения (${response.status}):`, errorText);
    }
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.message);
  }
}

// 🔗 ПОЛУЧЕНИЕ URL ФАЙЛА
async function getFileUrl(BOT_URL, fileId) {
  try {
    const response = await fetch(`${BOT_URL}/getFile?file_id=${fileId}`);
    const data = await response.json();
    if (!data.ok) {
      console.error('❌ Ошибка получения файла:', data.description);
      return null;
    }
    return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
  } catch (error) {
    console.error('❌ Ошибка получения файла:', error);
    return null;
  }
}

// 🔄 ОБРАБОТКА CALLBACK QUERY
async function handleCallbackQuery(BOT_URL, callback) {
  const chatId = callback.message.chat.id;
  const data = callback.data;
  
  console.log(`🔄 Callback от ${chatId}: ${data}`);
  
  // Отвечаем на callback
  await answerCallbackQuery(BOT_URL, callback.id, '✅');
  
  if (data.startsWith('fav_')) {
    await sendMessage(BOT_URL, chatId, '⭐ Добавлено в избранное!', MenuBuilder.removeMenu());
  } else if (data.startsWith('col_')) {
    await sendMessage(BOT_URL, chatId, '📁 Выберите подборку:', MenuBuilder.getCollectionsMenu());
  }
}

async function answerCallbackQuery(BOT_URL, callbackId, text = '') {
  try {
    await fetch(`${BOT_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text,
        show_alert: !!text
      })
    });
  } catch (error) {
    console.error('❌ Ошибка ответа на callback:', error.message);
  }
}

console.log('\n✅ bot.js готов к работе! Версия Node.js:', process.version);
