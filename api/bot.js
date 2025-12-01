const { Telegraf, Markup } = require('telegraf');

console.log('🚀 Sticker Bot запущен!');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Простое меню
const mainMenu = Markup.keyboard([
  ['🎨 Создать стикер', '❓ Помощь']
]).resize();

// /start
bot.start((ctx) => {
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n\n` +
    'Я бот для создания стикеров!\n' +
    'Просто отправь мне картинку 🖼️',
    mainMenu
  );
});

// Обработка фото
bot.on('photo', async (ctx) => {
  try {
    await ctx.reply('🔄 Обрабатываю изображение...');
    
    // Пытаемся создать стикер
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    await ctx.replyWithSticker({ url: fileUrl });
    await ctx.reply('✅ Стикер создан!');
    
  } catch (error) {
    console.error('Error:', error);
    ctx.reply('❌ Ошибка при создании стикера');
  }
});

// Webhook для Vercel
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.json({
      status: 'Bot is running (simple version)',
      node_version: process.version,
      platform: 'Vercel',
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      return res.json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};

// Для локального запуска
if (process.env.NODE_ENV === 'development') {
  bot.launch();
  console.log('🤖 Bot started in development mode');
}
