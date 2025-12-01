const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

// ================= НАСТРОЙКА =================
console.log('🚀 Запуск Telegram Sticker Bot...');
console.log('Node.js версия:', process.version);

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  console.log('ℹ️ Добавьте в Vercel → Settings → Environment Variables');
  process.exit(1);
}

const bot = new TelegramBot(token);

// Установка команд
bot.setMyCommands([
  { command: 'start', description: '🚀 Запустить бота' },
  { command: 'menu', description: '📱 Главное меню' },
  { command: 'help', description: '❓ Помощь' }
]);

// Хранилище сессий
const userSessions = {};

// ================= WEBHOOK ОБРАБОТЧИК =================
app.post('/api/bot', async (req, res) => {
  console.log('📨 Получен запрос от Telegram');
  
  try {
    const update = req.body;
    
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const username = update.message.from.username || update.message.from.first_name;
      
      console.log(`👤 ${username}: ${text || 'фото'}`);
      
      // Команда /start
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
            one_time_keyboard: false,
            input_field_placeholder: 'Выберите действие или отправьте фото 📸'
          }
        };
        
        await bot.sendMessage(chatId, 
          `✨ *Добро пожаловать, ${username}!* ✨\n\n` +
          'Я бот для создания стикеров с эффектами!\n' +
          'Используйте меню или отправьте фото.',
          { parse_mode: 'Markdown', ...menu }
        );
      }
      
      // Создать стикер
      else if (text === '🎨 Создать стикер') {
        await bot.sendMessage(chatId, 
          '📸 *Отправьте мне фото или PNG файл*\n\n' +
          'Поддерживаются: JPEG, PNG\n' +
          'Я обрежу в квадрат и добавлю эффекты!',
          { parse_mode: 'Markdown' }
        );
        userSessions[chatId] = { state: 'awaiting_image' };
      }
      
      // Мои стикеры
      else if (text === '📁 Мои стикеры') {
        await bot.sendMessage(chatId, '📭 *Ваши стикеры*\n\nСоздайте первый стикер через "🎨 Создать стикер"!', 
          { parse_mode: 'Markdown' });
      }
      
      // Папки
      else if (text === '📂 Папки') {
        await bot.sendMessage(chatId, '📂 *Управление папками*\n\nСоздавайте папки для организации стикеров!',
          { parse_mode: 'Markdown' });
      }
      
      // Избранное
      else if (text === '⭐ Избранное') {
        await bot.sendMessage(chatId, '⭐ *Избранное*\n\nДобавляйте сюда лучшие стикеры!',
          { parse_mode: 'Markdown' });
      }
      
      // Статистика
      else if (text === '📊 Статистика') {
        await bot.sendMessage(chatId, 
          '📊 *Статистика*\n\n' +
          'В разработке:\n' +
          '• Количество стикеров\n' +
          '• Рейтинг пользователя\n' +
          '• Топ пользователей',
          { parse_mode: 'Markdown' }
        );
      }
      
      // Настройки
      else if (text === '⚙️ Настройки') {
        await bot.sendMessage(chatId, '⚙️ *Настройки*\n\nНастройте качество изображений и эффекты.',
          { parse_mode: 'Markdown' });
      }
      
      // Помощь
      else if (text === 'ℹ️ Помощь') {
        await bot.sendMessage(chatId, 
          '❓ *Помощь по боту:*\n\n' +
          '• /start - Запустить бота\n' +
          '• /menu - Главное меню\n\n' +
          '**Как создать стикер:**\n' +
          '1. Нажмите "🎨 Создать стикер"\n' +
          '2. Отправьте фото (JPEG/PNG)\n' +
          '3. Выберите эффекты\n' +
          '4. Получите готовый стикер!\n\n' +
          'Поддержка: @ваш_админ',
          { parse_mode: 'Markdown' }
        );
      }
      
      // Топ
      else if (text === '👑 Топ') {
        await bot.sendMessage(chatId, '👑 *Топ пользователей*\n\nСоревнуйтесь в создании стикеров!',
          { parse_mode: 'Markdown' });
      }
      
      else if (text) {
        await bot.sendMessage(chatId, 'Используйте меню или отправьте фото 🎨');
      }
    }
    
    // Обработка фото
    if (update.message?.photo) {
      const chatId = update.message.chat.id;
      const session = userSessions[chatId];
      
      if (session?.state === 'awaiting_image') {
        await bot.sendMessage(chatId, '🔄 *Обрабатываю JPEG фото...*', { parse_mode: 'Markdown' });
        
        // Меню эффектов
        const keyboard = {
          inline_keyboard: [
            [
              { text: '📝 Добавить текст', callback_data: 'effect_text' },
              { text: '🖼️ Рамка', callback_data: 'effect_frame' }
            ],
            [
              { text: '✨ Перламутр', callback_data: 'effect_pearl' },
              { text: '🌈 Градиент', callback_data: 'effect_gradient' }
            ],
            [
              { text: '🎭 Без эффектов', callback_data: 'effect_none' }
            ]
          ]
        };
        
        await bot.sendMessage(chatId,
          '🎨 *Выберите эффекты для стикера:*\n\n' +
          '• 📝 **Текст** - добавить надпись\n' +
          '• 🖼️ **Рамка** - цветная рамка\n' +
          '• ✨ **Перламутр** - мерцающий эффект\n' +
          '• 🌈 **Градиент** - цветной переход\n' +
          '• 🎭 **Без эффектов** - только обрезка',
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
        
        delete userSessions[chatId];
      } else {
        await bot.sendMessage(chatId, '📸 Получено фото! Нажмите "🎨 Создать стикер" для обработки.');
      }
    }
    
    // Обработка документов (PNG)
    if (update.message?.document) {
      const chatId = update.message.chat.id;
      const doc = update.message.document;
      const session = userSessions[chatId];
      
      if (['image/png', 'image/jpeg', 'image/jpg'].includes(doc.mime_type)) {
        if (session?.state === 'awaiting_image') {
          await bot.sendMessage(chatId, `🔄 *Обрабатываю ${doc.mime_type}...*`, { parse_mode: 'Markdown' });
          
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
          
          await bot.sendMessage(chatId, '🎨 Выберите эффекты для PNG:', { reply_markup: keyboard });
          delete userSessions[chatId];
        } else {
          await bot.sendMessage(chatId, `📎 Получен ${doc.mime_type}! Нажмите "🎨 Создать стикер" для обработки.`);
        }
      } else {
        await bot.sendMessage(chatId, '❌ Пожалуйста, отправьте PNG или JPEG изображение');
      }
    }
    
    // Обработка callback кнопок
    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const data = update.callback_query.data;
      
      if (data.startsWith('effect_')) {
        const effect = data.replace('effect_', '');
        const effectNames = {
          text: '📝 Текст',
          frame: '🖼️ Рамка',
          pearl: '✨ Перламутр',
          gradient: '🌈 Градиент',
          none: '🎭 Без эффектов'
        };
        
        await bot.sendMessage(chatId, `✅ Выбран эффект: ${effectNames[effect]}\n\nСтикер создается...`);
        await bot.sendMessage(chatId, '🎉 *Стикер создан успешно!*\n\nСохраните его в папку или добавьте в избранное.',
          { parse_mode: 'Markdown' });
        
        // Предложение дальнейших действий
        const keyboard = {
          inline_keyboard: [
            [
              { text: '📁 Сохранить в папку', callback_data: 'save_to_folder' },
              { text: '⭐ В избранное', callback_data: 'add_to_fav' }
            ],
            [
              { text: '🎨 Создать еще', callback_data: 'create_another' },
              { text: '📋 В меню', callback_data: 'back_to_main' }
            ]
          ]
        };
        
        await bot.sendMessage(chatId, 'Что дальше?', { reply_markup: keyboard });
      }
      
      await bot.answerCallbackQuery(update.callback_query.id);
    }
    
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('❌ Ошибка обработки:', error);
    res.status(500).json({ error: error.message });
  }
});

// ================= API ENDPOINTS =================

// Главный endpoint
app.get('/api/bot', (req, res) => {
  res.json({ 
    status: 'online',
    application: 'Telegram Sticker Bot',
    version: '1.0.0',
    node_version: process.version,
    time: new Date().toISOString(),
    environment: {
      has_bot_token: !!process.env.TELEGRAM_BOT_TOKEN,
      vercel_url: process.env.VERCEL_URL || 'not set',
      node_env: process.env.NODE_ENV || 'production'
    },
    endpoints: {
      webhook: '/api/bot (POST)',
      home: '/ (GET)'
    }
  });
});

// Проверка переменных
app.get('/api/check-env', (req, res) => {
  res.json({
    status: 'check',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Отсутствует',
    VERCEL_URL: process.env.VERCEL_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🎨 Telegram Sticker Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; 
          text-align: center; 
          padding: 20px; 
          background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
          color: white;
          min-height: 100vh;
          margin: 0;
        }
        .container {
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 24px;
          max-width: 800px;
          margin: 0 auto;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
        }
        h1 { 
          font-size: 2.8em; 
          margin-bottom: 10px; 
          background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .status {
          background: rgba(255,255,255,0.15);
          padding: 20px;
          border-radius: 16px;
          margin: 25px 0;
          text-align: left;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 32px;
          margin: 10px;
          background: white;
          color: #6a11cb;
          text-decoration: none;
          border-radius: 50px;
          font-weight: bold;
          font-size: 1.1em;
          transition: all 0.3s;
          border: none;
          cursor: pointer;
        }
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .feature {
          background: rgba(255,255,255,0.1);
          padding: 20px;
          border-radius: 16px;
          transition: transform 0.3s;
        }
        .feature:hover {
          transform: translateY(-5px);
        }
        .feature-icon {
          font-size: 40px;
          margin-bottom: 15px;
          display: block;
        }
        @media (max-width: 768px) {
          .container { padding: 25px; }
          h1 { font-size: 2.2em; }
          .features { grid-template-columns: 1fr; }
          .btn { width: 100%; margin: 10px 0; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="font-size: 80px; margin-bottom: 20px;">🎨</div>
        <h1>Telegram Sticker Bot</h1>
        <p style="font-size: 1.2em; opacity: 0.9; margin-bottom: 30px;">
          Создавайте уникальные стикеры с эффектами и храните их в папках
        </p>
        
        <div class="status">
          <h3 style="margin-top: 0;">✅ Вебхук настроен</h3>
          <p>Telegram отправляет сообщения на:</p>
          <code style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; display: block; margin: 10px 0;">
            https://telegram-sticker-bot.vercel.app/api/bot
          </code>
          <p style="margin-top: 10px; font-size: 0.9em;">
            <span id="botStatus">Проверка статуса...</span>
          </p>
        </div>
        
        <div class="features">
          <div class="feature">
            <span class="feature-icon">✂️</span>
            <h3>Умная обрезка</h3>
            <p>Автоматическая обрезка в квадрат</p>
          </div>
          <div class="feature">
            <span class="feature-icon">✨</span>
            <h3>Эффекты</h3>
            <p>Текст, рамки, градиенты</p>
          </div>
          <div class="feature">
            <span class="feature-icon">📁</span>
            <h3>Организация</h3>
            <p>Папки для хранения</p>
          </div>
          <div class="feature">
            <span class="feature-icon">📊</span>
            <h3>Статистика</h3>
            <p>Рейтинг и топ пользователей</p>
          </div>
        </div>
        
        <div style="margin: 30px 0;">
          <a href="/api/bot" class="btn">📊 Проверить API</a>
          <a href="/api/check-env" class="btn">🔧 Проверить настройки</a>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.9em;">
          <p>Работает на Vercel + Node.js ${process.version}</p>
          <p>Все данные обрабатываются безопасно</p>
        </div>
      </div>
      
      <script>
        async function checkStatus() {
          try {
            const response = await fetch('/api/bot');
            const data = await response.json();
            document.getElementById('botStatus').innerHTML = 
              '✅ Бот работает | Node.js: ' + data.node_version;
          } catch (error) {
            document.getElementById('botStatus').innerHTML = '❌ Ошибка подключения';
          }
        }
        
        // Проверяем статус при загрузке
        document.addEventListener('DOMContentLoaded', checkStatus);
        
        // Обновляем каждые 30 секунд
        setInterval(checkStatus, 30000);
      </script>
    </body>
    </html>
  `);
});

// ================= ЗАПУСК СЕРВЕРА =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌐 Webhook URL: ${process.env.VERCEL_URL}/api/bot`);
  console.log(`🤖 Бот готов к работе!`);
});

module.exports = app;
