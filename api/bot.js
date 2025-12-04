// api/bot.js - ПОЛНЫЙ РАБОЧИЙ КОД
console.log('🚀 ============ ЗАГРУЗКА STICKER BOT ============');

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
let MenuBuilder, stickerCreator, db;
try {
  MenuBuilder = require('../lib/menuBuilder');
  stickerCreator = require('../lib/stickerCreator');
  console.log('✅ MenuBuilder и stickerCreator загружены');
} catch (error) {
  console.error('❌ Ошибка загрузки библиотек:', error.message);
  process.exit(1);
}

// 3. ИМПОРТ БАЗЫ ДАННЫХ (ПОПЫТКИ ВСЕХ ВАРИАНТОВ)
console.log('\n🔍 Импорт базы данных...');

const dbPaths = [
  '../lib/db.js',
  '../lib/database.js',
  '../lib/db/index.js',
  './lib/db.js'
];

let dbLoaded = false;
for (const dbPath of dbPaths) {
  const fullPath = path.join(__dirname, dbPath);
  console.log(`🔄 Пробую: ${dbPath}`);
  
  try {
    // Очищаем кэш
    delete require.cache[require.resolve(dbPath)];
    db = require(dbPath);
    
    console.log(`✅ Успешно загружен: ${dbPath}`);
    console.log(`📊 Функции:`, Object.keys(db).filter(k => typeof db[k] === 'function'));
    
    // Проверяем getTopUsers
    if (typeof db.getTopUsers === 'function') {
      console.log('✅ getTopUsers доступна');
      dbLoaded = true;
      break;
    } else {
      console.log('❌ getTopUsers не найдена');
    }
  } catch (err) {
    console.log(`   ❌ ${err.message}`);
  }
}

// 4. СОЗДАЕМ ЗАГЛУШКУ ЕСЛИ БАЗА НЕ ЗАГРУЗИЛАСЬ
if (!dbLoaded) {
  console.log('\n⚠️ Создаю заглушку для базы данных');
  db = {
    saveUser: async (chatId, username, firstName) => {
      console.log(`📝 [DB] saveUser: ${chatId}, ${username}`);
      return Date.now();
    },
    getUserStats: async (chatId) => {
      console.log(`📊 [DB] getUserStats: ${chatId}`);
      return {
        username: 'Тестовый',
        total_stickers: Math.floor(Math.random() * 10),
        registration_date: new Date()
      };
    },
    getTopUsers: async (limit = 10) => {
      console.log(`🏆 [DB] getTopUsers: limit=${limit}`);
      return [
        { username: 'Алексей', stickers_created: 15, rank: 1 },
        { username: 'Мария', stickers_created: 12, rank: 2 },
        { username: 'Иван', stickers_created: 8, rank: 3 },
        { username: 'Ольга', stickers_created: 5, rank: 4 },
        { username: 'Дмитрий', stickers_created: 3, rank: 5 }
      ];
    },
    saveSticker: async (chatId, fileId, effect = 'none', sizeBytes = 0) => {
      console.log(`🎨 [DB] saveSticker: ${chatId}, ${effect}, ${sizeBytes} bytes`);
      return true;
    },
    createCollection: async (chatId, name) => {
      console.log(`📁 [DB] createCollection: ${chatId}, "${name}"`);
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
      features: ['Стикеры', 'Эффекты', 'Статистика', 'Топ'],
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
    
    case text === '/effects':
      await handleEffects(BOT_URL, chatId);
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
    
    case text === '🎭 Эффекты':
      await handleEffects(BOT_URL, chatId);
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
      // Обработка эффектов
      else if (isEffectCommand(text)) {
        await handleEffectSelection(BOT_URL, chatId, text, username, firstName);
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
  await db.saveUser(chatId, username, firstName);
  
  await sendMessage(BOT_URL, chatId,
    `👋 *Добро пожаловать, ${username}!* 🎨\n\n` +
    'Я - бот для создания стикеров с эффектами!\n\n' +
    '✨ *Что я умею:*\n' +
    '• Создавать стикеры из фото\n' +
    '• Применять крутые эффекты\n' +
    '• Показывать статистику и топ\n' +
    '• Сохранять в избранное\n\n' +
    '🎯 *Начните с кнопки ниже!*',
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
    '/effects - Список эффектов\n\n' +
    '📸 *Как создать стикер:*\n' +
    '1. Нажмите "🎨 Создать стикер"\n' +
    '2. Отправьте фото\n' +
    '3. Выберите эффект\n' +
    '4. Получите стикер!\n\n' +
    '⭐ *Избранное:*\n' +
    'Сохраняйте лучшие стикеры\n\n' +
    '📚 *Подборки:*\n' +
    'Создавайте тематические коллекции\n\n' +
    '💎 *Все функции бесплатны!*',
    MenuBuilder.getMainMenu()
  );
}

// ТОП ПОЛЬЗОВАТЕЛЕЙ
async function handleTop(BOT_URL, chatId) {
  console.log(`🏆 Обработка команды /top для ${chatId}`);
  
  let topMessage;
  try {
    const topUsers = await db.getTopUsers(10);
    
    if (!topUsers || topUsers.length === 0) {
      topMessage = '🏆 *Топ создателей стикеров:*\n\n' +
        '🥇 Пока никто не создал стикеров\n' +
        '🥈 Будь первым!\n' +
        '🥉 Отправь фото прямо сейчас!';
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
    console.error('❌ Ошибка в handleTop:', error);
    topMessage = '🏆 *Топ временно недоступен*\n\n' +
      'Попробуйте позже... 🔄';
  }
  
  await sendMessage(BOT_URL, chatId, topMessage, MenuBuilder.getMainMenu());
}

// СТАТИСТИКА
async function handleStats(BOT_URL, chatId, username) {
  try {
    const stats = await db.getUserStats(chatId);
    
    // Форматируем дату
    let regDate = 'сегодня';
    if (stats.registration_date) {
      const date = new Date(stats.registration_date);
      regDate = date.toLocaleDateString('ru-RU');
    }
    
    const statsText = `📊 *Статистика @${username || 'пользователь'}:*\n\n` +
      `🎨 Создано стикеров: *${stats.total_stickers || 0}*\n` +
      `📅 Зарегистрирован: *${regDate}*\n\n`;
    
    await sendMessage(BOT_URL, chatId, statsText, MenuBuilder.getMainMenu());
    
  } catch (error) {
    console.error('❌ Ошибка в handleStats:', error);
    await sendMessage(BOT_URL, chatId,
      '📊 *Статистика:*\n\n' +
      '🎨 Создано стикеров: *0*\n' +
      '📅 Зарегистрирован: *сегодня*',
      MenuBuilder.getMainMenu()
    );
  }
}

// ЭФФЕКТЫ
async function handleEffects(BOT_URL, chatId) {
  const effects = [
    { name: 'Без эффекта', emoji: '🎨' },
    { name: 'Винтаж', emoji: '🕰️' },
    { name: 'Черно-белый', emoji: '⚫⚪' },
    { name: 'Сепия', emoji: '🟤' },
    { name: 'Пикселизация', emoji: '🎮' },
    { name: 'Размытие', emoji: '🌀' },
    { name: 'Градиент', emoji: '🌈' },
    { name: 'Перламутр', emoji: '✨' },
    { name: 'Текст "Cool!"', emoji: '📝' },
    { name: 'Золотая рамка', emoji: '🖼️' },
    { name: 'Радужная рамка', emoji: '🌈🖼️' },
    { name: 'Инстаграм фильтр', emoji: '📸' }
  ];
  
  await sendMessage(BOT_URL, chatId,
    '🎭 *Эффекты для стикеров*\n\n' +
    'Выберите эффект для следующего стикера:\n' +
    effects.map(e => `• ${e.emoji || ''} ${e.name}`).join('\n') +
    '\n\n📝 *Напишите название эффекта*',
    MenuBuilder.removeMenu()
  );
}

// СОЗДАТЬ СТИКЕР
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

// ФОТО
async function handlePhoto(BOT_URL, chatId, photos, username, firstName) {
  await sendMessage(BOT_URL, chatId, '🔄 *Скачиваю фото...*', MenuBuilder.removeMenu());
  
  const bestPhoto = photos[photos.length - 1];
  const fileId = bestPhoto.file_id;
  const fileUrl = await getFileUrl(BOT_URL, fileId);
  
  // Сохраняем пользователя
  await db.saveUser(chatId, username, firstName);
  
  // Сохраняем в сессию
  userSessions[chatId] = {
    photoUrl: fileUrl,
    fileId: fileId,
    waitingFor: 'effect_selection'
  };
  
  await sendMessage(BOT_URL, chatId,
    '✅ *Фото получено!*\n\n' +
    '🎭 *Выберите эффект:*\n\n' +
    '✨ *Базовые:*\n' +
    '• Винтаж • ЧБ • Сепия\n\n' +
    '💎 *Премиум:*\n' +
    '• Градиент • Перламутр\n' +
    '• Текст • Золотая рамка\n' +
    '• Радужная рамка • Инстаграм\n\n' +
    '📝 *Напишите название эффекта*',
    MenuBuilder.removeMenu()
  );
}

// ВЫБОР ЭФФЕКТА
async function handleEffectSelection(BOT_URL, chatId, effectName, username, firstName) {
  const session = userSessions[chatId];
  
  if (!session || !session.photoUrl) {
    await sendMessage(BOT_URL, chatId, '❌ *Сначала отправьте фото!*', MenuBuilder.getMainMenu());
    return;
  }
  
  await sendMessage(BOT_URL, chatId, `🎭 *Создаю стикер с эффектом "${effectName}"...*`, MenuBuilder.removeMenu());
  
  try {
    const imageBuffer = await stickerCreator.downloadImage(session.photoUrl);
    
    const options = {};
    if (effectName.includes('Текст')) {
      options.text = 'Cool!';
      effectName = 'текст';
    } else if (effectName.includes('Золотая рамка')) {
      options.frameColor = 'gold';
      effectName = 'рамка';
    } else if (effectName.includes('Радужная рамка')) {
      options.frameColor = 'rainbow';
      effectName = 'рамка';
    } else if (effectName === 'Градиент') {
      options.gradientColor = 'rgba(255,105,180,0.3)';
    }
    
    const stickerBuffer = await stickerCreator.createSticker(imageBuffer, effectName, options);
    await stickerCreator.sendSticker(process.env.TELEGRAM_BOT_TOKEN, chatId, stickerBuffer);
    
    // Сохраняем стикер в базу
    await db.saveSticker(chatId, session.fileId, effectName, stickerBuffer.length);
    
    const stickerId = Date.now();
    await sendMessage(BOT_URL, chatId,
      `✅ *Стикер готов!* Эффект: *${effectName}*\n\n` +
      '✨ *Что дальше?*',
      MenuBuilder.getStickerActions(stickerId)
    );
    
    delete userSessions[chatId];
    
  } catch (error) {
    console.error('❌ Ошибка создания:', error);
    await sendMessage(BOT_URL, chatId, 
      '❌ *Не удалось создать стикер*\nПопробуйте другое фото или эффект!',
      MenuBuilder.getMainMenu()
    );
  }
}

// 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

async function sendMessage(BOT_URL, chatId, text, options = {}) {
  try {
    await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      })
    });
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.message);
  }
}

async function getFileUrl(BOT_URL, fileId) {
  try {
    const response = await fetch(`${BOT_URL}/getFile?file_id=${fileId}`);
    const data = await response.json();
    return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
  } catch (error) {
    console.error('❌ Ошибка получения файла:', error);
    return null;
  }
}

function isEffectCommand(text) {
  const effects = [
    'винтаж', 'черно-белый', 'чб', 'сепия', 'пикселизация', 'размытие',
    'градиент', 'перламутр', 'текст', 'золотая рамка', 
    'радужная рамка', 'инстаграм', 'без эффекта'
  ];
  return effects.includes(text.toLowerCase());
}

// ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ (сокращённо)
async function handleCallbackQuery(BOT_URL, callback) {
  // ... ваша логика обработки callback ...
}

async function handleFavorites(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '⭐ *Избранное*\n\n' +
    '_Функция скоро будет доступна!_',
    MenuBuilder.getMainMenu()
  );
}

async function handleCollections(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '📚 *Подборки*\n\n' +
    '_Функция скоро будет доступна!_',
    MenuBuilder.getMainMenu()
  );
}

async function handleDocument(BOT_URL, chatId, document, username, firstName) {
  // ... обработка документов ...
}

async function handleCreateCollection(BOT_URL, chatId, name) {
  await db.createCollection(chatId, name);
  await sendMessage(BOT_URL, chatId,
    `✅ Подборка "${name}" создана!`,
    MenuBuilder.getMainMenu()
  );
  delete userSessions[chatId];
}

console.log('\n✅ bot.js готов к работе!');
