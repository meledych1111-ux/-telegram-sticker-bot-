const { processMessage } = require('../lib/telegramAPI');
const { downloadImage, createSticker } = require('../lib/imageProcessor');

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Обрабатываем предварительные запросы
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      await processMessage(req.body);
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('Error:', error);
      res.status(200).json({ status: 'error', error: error.message });
    }
  } else {
    // GET запрос - показываем информацию
    res.status(200).json({
      status: 'Bot is running! 🚀',
      description: 'Telegram Sticker Bot - создание стикеров из изображений',
      usage: 'Найдите бота в Telegram и отправьте ему изображение'
    });
  }
};
