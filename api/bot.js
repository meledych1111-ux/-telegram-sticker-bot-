// ⚡  api/bot.js  –  входная точка Vercel-функции
const { processMessage } = require('../lib/telegramAPI');
const { initializeDatabase } = require('../lib/database');

let isInitialized = false;

async function initializeBot() {
  if (isInitialized) return;

  console.log('🤖  Инициализация Telegram-бота...');
  try {
    await initializeDatabase();
    console.log('✅  Бот инициализирован и готов к работе!');
  } catch (error) {
    console.error('❌  Ошибка инициализации бота:', error);
    // не падаем, чтобы Vercel не убил функцию
  } finally {
    isInitialized = true;
  }
}

// запускаем сразу
initializeBot();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Бот работает!',
      message: 'Найдите бота в Telegram и отправьте изображение',
      bot_username: '@MyStickerMakertBot',
      database_initialized: isInitialized,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    try {
      if (!isInitialized) await initializeBot();
      await processMessage(req.body);
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('❌ Ошибка в api/bot.js:', error);
      return res.status(200).json({ status: 'error', error: error.message });
    }
  }

  res.status(404).json({ error: 'Не найдено' });
};
