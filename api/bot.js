const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// ========== ИНИЦИАЛИЗАЦИЯ ==========
console.log('🚀 Запуск Telegram Sticker Bot...');
console.log('Node.js версия:', process.version);

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  console.log('');
  console.log('========================== ВНИМАНИЕ ==========================');
  console.log('Добавьте переменную в Vercel Dashboard:');
  console.log('1. Откройте https://vercel.com/');
  console.log('2. Выберите проект → Settings → Environment Variables');
  console.log('3. Добавьте переменную:');
  console.log('   Name: TELEGRAM_BOT_TOKEN');
  console.log('   Value: 8497134153:AAEQtYTVv-hCQ08HkD6Wwm6k2qsjmCHCgJI');
  console.log('4. Нажмите "Save"');
  console.log('5. Передеплойте проект');
  console.log('==============================================================');
  
  // Для Vercel нужно экспортировать функцию даже при ошибке
  module.exports = (req, res) => {
    res.status(500).json({
      error: 'TELEGRAM_BOT_TOKEN not configured',
      message: 'Add TELEGRAM_BOT_TOKEN to Environment Variables in Vercel Dashboard'
    });
  };
  return;
}

const bot = new TelegramBot(token);
const userSessions = {};

// Создаем Express app
const app = express();
app.use(express.json());

// ========== WEBHOOK HANDLER ==========
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

// ========== API ENDPOINTS ==========
app.get('/api/bot', (req, res) => {
  res.json({ 
    status: 'online',
    bot: 'Telegram Sticker Bot',
    version: '1.0.0',
    node: process.version,
    time: new Date().toISOString(),
    webhook: `${process.env.VERCEL_URL || 'https://your-project.vercel.app'}/api/bot`
  });
});

app.get('/api/check-env', (req, res) => {
  res.json({
    has_token: !!process.env.TELEGRAM_BOT_TOKEN,
    vercel_url: process.env.VERCEL_URL,
    node_env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

app.get('/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = `${process.env.VERCEL_URL || 'https://your-project.vercel.app'}/api/bot`;
    await bot.setWebHook(webhookUrl);
    
    res.json({
      success: true,
      message: 'Webhook установлен',
      webhook: webhookUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Telegram Sticker Bot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sticker Bot</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: 'Arial', sans-serif; 
          text-align: center; 
          padding: 40px; 
          background: linear-gradient(135deg, #667eea, #764ba2); 
          color: white; 
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container { 
          background: rgba(255,255,255,0.1); 
          padding: 50px; 
          border-radius: 25px; 
          max-width: 700px; 
          width: 100%;
          backdrop-filter: blur(10px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        h1 { 
          font-size: 3em; 
          margin-bottom: 20px;
          color: white;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        p { 
          font-size: 1.2em; 
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .status {
          background: rgba(255,255,255,0.2);
          padding: 20px;
          border-radius: 15px;
          margin: 20px 0;
        }
        .btn { 
          display: inline-block; 
          padding: 15px 35px; 
          margin: 10px; 
          background: white; 
          color: #667eea; 
          text-decoration: none; 
          border-radius: 50px; 
          font-weight: bold;
          font-size: 1.1em;
          transition: all 0.3s;
          border: 2px solid transparent;
        }
        .btn:hover {
          background: transparent;
          color: white;
          border: 2px solid white;
          transform: translateY(-3px);
        }
        .logo {
          font-size: 4em;
          margin-bottom: 20px;
          display: block;
        }
        .info {
          text-align: left;
          background: rgba(0,0,0,0.2);
          padding: 20px;
          border-radius: 15px;
          margin: 25px 0;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🎨</div>
        <h1>Telegram Sticker Bot</h1>
        
        <div class="status">
          <p>✅ Бот работает на Vercel</p>
          <p>Node.js ${process.version}</p>
          <p>Токен: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}</p>
        </div>
        
        <div class="info">
          <p><strong>Вебхук URL:</strong> ${process.env.VERCEL_URL || 'https://your-project.vercel.app'}/api/bot</p>
          <p><strong>Токен бота:</strong> ${process.env.TELEGRAM_BOT_TOKEN ? '8497134153:AAE...' : 'Не установлен'}</p>
        </div>
        
        <div>
          <a href="/api/bot" class="btn">📊 Проверить API</a>
          <a href="/api/check-env" class="btn">⚙️ Настройки</a>
          <a href="/health" class="btn">❤️ Health Check</a>
          <a href="/setup-webhook" class="btn">🔗 Установить вебхук</a>
        </div>
        
        <p style="margin-top: 40px; font-size: 0.9em; opacity: 0.8;">
          Проект развернут на Vercel Free Tier с Node.js 24
        </p>
      </div>
    </body>
    </html>
  `);
});

// ========== VERCEL EXPORT ==========
// ВАЖНО: Для Vercel нужно экспортировать app
module.exports = app;

// ========== ЛОКАЛЬНЫЙ ЗАПУСК ==========
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Webhook URL: ${process.env.VERCEL_URL || 'http://localhost:' + PORT}/api/bot`);
    
    // Устанавливаем вебхук автоматически при локальном запуске
    if (process.env.VERCEL_URL) {
      const webhookUrl = `${process.env.VERCEL_URL}/api/bot`;
      bot.setWebHook(webhookUrl)
        .then(() => console.log(`✅ Webhook установлен: ${webhookUrl}`))
        .catch(err => console.error('❌ Ошибка установки webhook:', err.message));
    }
  });
}
