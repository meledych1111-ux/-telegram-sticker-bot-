const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// Сначала создаем app
const app = express();
app.use(express.json());

console.log('🚀 Запуск Telegram Sticker Bot...');
console.log('Node.js версия:', process.version);

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  process.exit(1);
}

const bot = new TelegramBot(token);
const userSessions = {};

// ================= WEBHOOK =================
app.post('/api/bot', async (req, res) => {
  console.log('📨 Получен запрос от Telegram');
  
  try {
    const update = req.body;
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const username = update.message.from.username || update.message.from.first_name;
      
      console.log(`👤 ${username}: ${text || 'фото'}`);
      
      if (text === '/start') {
        const menu = {
          reply_markup: {
            keyboard: [
              [{ text: '🎨 Создать стикер' }, { text: '📁 Мои стикеры' }],
              [{ text: '📂 Папки' }, { text: '⭐ Избранное' }],
              [{ text: '📊 Статистика' }, { text: '⚙️ Настройки' }],
              [{ text: 'ℹ️ Помощь' }, { text: '👑 Топ' }]
            ],
            resize_keyboard: true,
            input_field_placeholder: 'Выберите действие'
          }
        };
        
        await bot.sendMessage(chatId, 
          `✨ *Добро пожаловать, ${username}!*\n\nЯ бот для создания стикеров!\nОтправьте фото или используйте меню.`,
          { parse_mode: 'Markdown', ...menu }
        );
      }
      else if (text === '🎨 Создать стикер') {
        await bot.sendMessage(chatId, '📸 Отправьте мне фото или PNG для создания стикера!');
        userSessions[chatId] = { state: 'awaiting_image' };
      }
      else if (text === '📁 Мои стикеры') {
        await bot.sendMessage(chatId, '📭 Создайте первый стикер через "🎨 Создать стикер"');
      }
      else if (text === '📂 Папки') {
        await bot.sendMessage(chatId, '📂 Создавайте папки для организации стикеров');
      }
      else if (text === '📊 Статистика') {
        await bot.sendMessage(chatId, '📊 Статистика в разработке');
      }
      else if (text === 'ℹ️ Помощь') {
        await bot.sendMessage(chatId, '❓ Помощь:\n1. Нажмите "🎨 Создать стикер"\n2. Отправьте фото\n3. Получите стикер!');
      }
      else if (text) {
        await bot.sendMessage(chatId, 'Используйте меню или отправьте фото 🎨');
      }
    }
    
    // Фото
    if (update.message?.photo) {
      const chatId = update.message.chat.id;
      const session = userSessions[chatId];
      
      if (session?.state === 'awaiting_image') {
        await bot.sendMessage(chatId, '🔄 Обрабатываю фото...');
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '📝 Добавить текст', callback_data: 'effect_text' },
              { text: '🖼️ Рамка', callback_data: 'effect_frame' }
            ],
            [
              { text: '✨ Перламутр', callback_data: 'effect_pearl' },
              { text: '🌈 Градиент', callback_data: 'effect_gradient' }
            ]
          ]
        };
        
        await bot.sendMessage(chatId, '🎨 Выберите эффекты:', { reply_markup: keyboard });
        delete userSessions[chatId];
      } else {
        await bot.sendMessage(chatId, '📸 Получено фото! Нажмите "🎨 Создать стикер"');
      }
    }
    
    // PNG
    if (update.message?.document) {
      const chatId = update.message.chat.id;
      const doc = update.message.document;
      
      if (['image/png', 'image/jpeg'].includes(doc.mime_type)) {
        await bot.sendMessage(chatId, `📎 Получен ${doc.mime_type}!`);
      }
    }
    
    // Callback кнопки
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const data = update.callback_query.data;
      
      if (data.startsWith('effect_')) {
        await bot.sendMessage(chatId, '✅ Эффект применен! Стикер создается...');
        await bot.sendMessage(chatId, '🎉 Стикер готов!');
      }
      
      await bot.answerCallbackQuery(update.callback_query.id);
    }
    
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});

// ================= API ENDPOINTS =================
app.get('/api/bot', (req, res) => {
  res.json({ 
    status: 'online',
    bot: 'Telegram Sticker Bot',
    version: '1.0.0',
    node: process.version,
    time: new Date().toISOString()
  });
});

app.get('/api/check-env', (req, res) => {
  res.json({
    has_token: !!process.env.TELEGRAM_BOT_TOKEN,
    vercel_url: process.env.VERCEL_URL,
    node_env: process.env.NODE_ENV
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Sticker Bot</title><style>
      body { font-family: Arial; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
      .container { background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; max-width: 600px; margin: 0 auto; }
      h1 { font-size: 2.5em; }
      .btn { display: inline-block; padding: 15px 30px; margin: 10px; background: white; color: #667eea; text-decoration: none; border-radius: 50px; font-weight: bold; }
    </style></head>
    <body>
      <div class="container">
        <h1>🎨 Telegram Sticker Bot</h1>
        <p>Node.js ${process.version}</p>
        <p>Бот работает! Вебхук настроен.</p>
        <p><a href="/api/bot" class="btn">Проверить API</a></p>
        <p><a href="/api/check-env" class="btn">Проверить настройки</a></p>
      </div>
    </body>
    </html>
  `);
});

// ================= СЕРВЕР =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Webhook: ${process.env.VERCEL_URL}/api/bot`);
});

module.exports = app;
