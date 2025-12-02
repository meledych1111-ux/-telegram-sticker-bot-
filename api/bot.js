// 📞 ОБРАБОТКА СООБЩЕНИЙ ОТ TELEGRAM API
// Временная версия БЕЗ БАЗЫ ДАННЫХ

// Закомментируйте импорт базы:
// const { saveUser, saveSticker, getUserStats, getTopUsers } = require('./database');
// const { downloadImage, createSticker } = require('./imageProcessor');
// const MenuBuilder = require('./menuBuilder');

// Простые заглушки вместо базы
async function saveUser(chatId, username, firstName) {
  console.log(`👤 Пользователь: ${username} (${chatId})`);
}

async function saveSticker(chatId, format, size, time) {
  console.log(`🎨 Стикер создан для ${chatId}`);
}

async function getUserStats(chatId) {
  return { total_stickers: 0, today_stickers: 0, collections_count: 0, favorites_count: 0 };
}

async function getTopUsers() {
  return [];
}

async function getAvailableEffects() {
  return [
    { name: 'none', description: 'Без эффекта', is_premium: false },
    { name: 'grayscale', description: 'Черно-белый', is_premium: false }
  ];
}

// Простые функции для изображений
async function downloadImage(url) {
  const response = await fetch(url);
  return Buffer.from(await response.arrayBuffer());
}

async function createSticker(imageBuffer) {
  return imageBuffer;
}

// Токен бота
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// 📨 Основная функция обработки сообщений
async function processMessage(update) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (!update.message) return;

  const message = update.message;
  const chatId = message.chat.id;
  const text = message.text || '';

  try {
    // Простая обработка команд
    if (text === '/start') {
      await sendMessage(chatId, '👋 Привет! Я бот для стикеров! Отправь мне картинку.');
      return;
    }

    if (text === '/help') {
      await sendMessage(chatId, '📖 Просто отправь мне изображение, и я сделаю стикер!');
      return;
    }

    // Обработка изображений
    if (message.photo) {
      await sendMessage(chatId, '🔄 Обрабатываю изображение...');
      // Здесь будет обработка, пока просто отвечаем
      await sendMessage(chatId, '✅ Готово! Стикер создан!');
      await saveSticker(chatId, 'photo', 0, 0);
      return;
    }

    // Любой другой текст
    if (text) {
      await sendMessage(chatId, 'Отправь мне картинку для создания стикера! 🎨');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    await sendMessage(chatId, '❌ Ошибка обработки');
  }
}

// 🔘 Обработка callback (заглушка)
async function handleCallbackQuery(callbackQuery) {
  console.log('Callback received:', callbackQuery.data);
}

// 📤 Отправка сообщения
async function sendMessage(chatId, text) {
  try {
    await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.message);
  }
}

module.exports = { processMessage };
