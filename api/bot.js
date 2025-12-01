const { Telegraf, Markup } = require('telegraf');

console.log('🚀 Starting sticker bot (no database)...');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Главное меню
const mainMenu = Markup.keyboard([
  ['🎨 Создать стикер', '❓ Помощь']
]).resize();

// /start
bot.start((ctx) => {
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n\n` +
    'Я бот для создания стикеров!\n' +
    'Отправь мне картинку и я сделаю стикер 🖼️\n\n' +
    '📌 База данных временно отключена',
    mainMenu
  );
});

// Обработка фото
bot.on('photo', async (ctx) => {
  try {
    const waitMsg = await ctx.reply('🔄 Создаю стикер...');
    
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    await ctx.replyWithSticker({ url: fileUrl });
    await ctx.reply('✅ Стикер готов! (без сохранения в базу)');
    
    await ctx.deleteMessage(waitMsg.message_id);
  } catch (error) {
    console.error('Error:', error);
    ctx.reply('❌ Ошибка при создании стикера');
  }
});

// Помощь
bot.hears('❓ Помощь', (ctx) => {
  ctx.reply(
    '📖 Просто отправь мне картинку!\n\n' +
    'Я создам стикер (база данных временно отключена).\n\n' +
    'Форматы: JPG, PNG, WebP\n' +
    'Размер: до 5 МБ'
  );
});

// Webhook handler
module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return res.json({
      status: 'Bot is running (no database)',
      node_version: process.version,
      platform: 'Vercel',
      timestamp: new Date().toISOString(),
      message: 'Database temporarily disabled'
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

// Для локальной разработки
if (process.env.NODE_ENV === 'development') {
  bot.launch();
  console.log('🤖 Bot started in development mode');
}
