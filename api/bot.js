import express from 'express';
import TelegramBot from 'node-telegram-bot-api';

const app = express();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// ========== КОМАНДЫ БОТА ==========

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  console.log(`/start от ${user.id} (@${user.username || 'без username'})`);
  
  await bot.sendMessage(chatId, 
    `🎉 *Привет, ${user.first_name || 'друг'}!*\n\n` +
    `🤖 Я — Telegram Sticker Bot\n` +
    `📸 Отправьте мне фото для создания стикера!\n\n` +
    `⚡ *Технологии:*\n` +
    `• Node.js ${process.version}\n` +
    `• Vercel Serverless\n` +
    `• Neon PostgreSQL\n\n` +
    `✅ Бот работает!`,
    { parse_mode: 'Markdown' }
  );
});

// /help
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `🆘 *Помощь*\n\n` +
    `📸 *Как использовать:*\n` +
    `1. Отправьте фото\n` +
    `2. Бот обработает изображение\n` +
    `3. Получите стикер\n\n` +
    `⚙️ *Команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Справка\n` +
    `/status - Статус бота`,
    { parse_mode: 'Markdown' }
  );
});

// /status
bot.onText(/\/status/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `📊 *Статус системы*\n\n` +
    `✅ Бот активен\n` +
    `⚡ Node.js ${process.version}\n` +
    `🌐 Vercel\n` +
    `📅 ${new Date().toLocaleString('ru-RU')}`,
    { parse_mode: 'Markdown' }
  );
});

// Обработка фото
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  console.log(`📸 Фото от ${user.id}`);
  
  await bot.sendMessage(chatId,
    `📸 *Фото получено!*\n\n` +
    `🔄 Обработка изображения...\n\n` +
    `✅ Скоро вы получите стикер!`,
    { parse_mode: 'Markdown' }
  );
});

// ========== API ENDPOINTS ==========

// Вебхук
app.post('/api/bot', express.json(), async (req, res) => {
  console.log('📨 Webhook получен:', req.body?.update_id);
  
  try {
    await bot.processUpdate(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  console.log('❤️ Health check');
  res.json({
    status: 'healthy',
    service: 'telegram-sticker-bot',
    version: '1.0.0',
    node: process.version,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Настройка вебхука
app.get('/api/setup-webhook', async (req, res) => {
  console.log('🔧 Настройка вебхука');
  
  try {
    const webhookUrl = `${process.env.VERCEL_URL}/api/bot`;
    await bot.setWebHook(webhookUrl);
    const botInfo = await bot.getMe();
    
    res.json({
      success: true,
      message: 'Webhook установлен',
      bot: {
        username: botInfo.username,
        name: botInfo.first_name,
        id: botInfo.id
      },
      webhook: webhookUrl,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Webhook setup error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 404 обработчик
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Путь ${req.path} не существует`,
    endpoints: ['/api/bot (POST)', '/api/health (GET)', '/api/setup-webhook (GET)']
  });
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('🔥 Server error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Произошла ошибка'
  });
});

export default app;
