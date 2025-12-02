// ⚡ МИНИМАЛЬНЫЙ TELEGRAM БОТ
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET request - health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Бот работает!',
      instructions: 'Отправьте /start боту в Telegram',
      timestamp: new Date().toISOString()
    });
  }

  // POST request - сообщение от Telegram
  if (req.method === 'POST') {
    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!TELEGRAM_BOT_TOKEN) {
        console.error('❌ TELEGRAM_BOT_TOKEN не установлен');
        return res.status(200).json({ 
          error: 'Добавьте TELEGRAM_BOT_TOKEN в Environment Variables Vercel' 
        });
      }

      const update = req.body;
      console.log('📨 Получено обновление от Telegram:', JSON.stringify(update, null, 2));

      // Обрабатываем сообщение
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        
        const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

        // Обработка команды /start
        if (text === '/start') {
          await fetch(`${BOT_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '👋 Привет! Я бот для создания стикеров!\n\nОтправь мне изображение, и я сделаю из него стикер! 🎨',
              parse_mode: 'Markdown'
            })
          });
        }
        // Обработка команды /help
        else if (text === '/help') {
          await fetch(`${BOT_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '📖 *Помощь по боту:*\n\n• Отправь любое изображение (фото, PNG, JPG)\n• Я автоматически создам стикер 512x512\n• Используй /start для начала\n• /help - эта справка',
              parse_mode: 'Markdown'
            })
          });
        }
        // Если отправили фото
        else if (update.message.photo) {
          await fetch(`${BOT_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '🔄 Получил твоё фото! Обрабатываю...\n\n*Скоро добавлю создание стикеров!* 🎨',
              parse_mode: 'Markdown'
            })
          });
        }
        // Любой другой текст
        else if (text) {
          await fetch(`${BOT_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: 'Отправь мне изображение для создания стикера! 🎨\n\nИли используй команды:\n/start - начать\n/help - помощь',
              parse_mode: 'Markdown'
            })
          });
        }
      }

      // Всегда возвращаем 200 OK Telegram
      return res.status(200).json({ ok: true });

    } catch (error) {
      console.error('❌ Ошибка обработки:', error);
      return res.status(200).json({ ok: true }); // Всегда 200 для Telegram
    }
  }

  // Любой другой метод
  return res.status(404).json({ error: 'Not Found' });
};
