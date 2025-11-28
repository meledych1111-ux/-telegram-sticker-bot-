// ⚡ ГЛАВНЫЙ ФАЙЛ - обрабатывает все запросы к боту
const { processMessage } = require('../lib/telegramAPI');

module.exports = async (req, res) => {
  // Разрешаем все типы запросов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обрабатываем предварительные запросы
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET запрос - информация о боте
  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Бот работает!',
      message: 'Найдите бота в Telegram и отправьте изображение',
      bot_username: '@MyStickerMakertBot',
      api_endpoint: '/api/bot'
    });
  }

  // POST запрос - сообщение от Telegram
  if (req.method === 'POST') {
    try {
      await processMessage(req.body);
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('❌ Ошибка в api/bot.js:', error);
      return res.status(200).json({ status: 'error', error: error.message });
    }
  }

  // Любые другие запросы
  res.status(404).json({ error: 'Не найдено' });
};
