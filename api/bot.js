const { Telegraf, Markup } = require('telegraf');
const { Pool } = require('pg');

// === 1. НАСТРОЙКА БАЗЫ ДАННЫХ ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Инициализация таблиц
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username VARCHAR(100),
        first_name VARCHAR(200)
      );
      
      CREATE TABLE IF NOT EXISTS stickers (
        file_id VARCHAR(300) PRIMARY KEY,
        user_id BIGINT,
        likes INT DEFAULT 0,
        dislikes INT DEFAULT 0
      );
    `);
    console.log('✅ База данных готова');
  } finally {
    client.release();
  }
}
initDB();

// === 2. ФУНКЦИИ БАЗЫ ДАННЫХ ===
const db = {
  async saveUser(userId, username, firstName) {
    await pool.query(`
      INSERT INTO users (user_id, username, first_name) 
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO NOTHING
    `, [userId, username || '', firstName || '']);
  },

  async saveSticker(fileId, userId) {
    await pool.query(`
      INSERT INTO stickers (file_id, user_id) 
      VALUES ($1, $2)
      ON CONFLICT (file_id) DO NOTHING
    `, [fileId, userId]);
  },

  async vote(fileId, voteType) {
    const column = voteType === 'like' ? 'likes' : 'dislikes';
    await pool.query(`
      UPDATE stickers 
      SET ${column} = ${column} + 1 
      WHERE file_id = $1
    `, [fileId]);
  },

  async getStats(fileId) {
    const result = await pool.query(
      'SELECT likes, dislikes FROM stickers WHERE file_id = $1',
      [fileId]
    );
    return result.rows[0] || { likes: 0, dislikes: 0 };
  }
};

// === 3. НАСТРОЙКА БОТА ===
const bot = new Telegraf(process.env.BOT_TOKEN);

// Главное меню
const mainMenu = Markup.keyboard([
  ['🎨 Создать стикер', '📊 Статистика'],
  ['🏆 Топ стикеров', '❓ Помощь']
]).resize();

// Кнопки голосования
function voteMenu(fileId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('👍 Лайк', `like_${fileId}`),
      Markup.button.callback('👎 Дизлайк', `dislike_${fileId}`)
    ]
  ]);
}

// === 4. КОМАНДЫ БОТА ===

// /start
bot.start(async (ctx) => {
  const user = ctx.from;
  await db.saveUser(user.id, user.username, user.first_name);
  
  await ctx.reply(
    `👋 Привет, ${user.first_name}!\n\n` +
    'Я создаю стикеры из твоих картинок!\n' +
    'Просто отправь мне фото и я сделаю стикер с рейтингом!',
    mainMenu
  );
});

// Обработка фото
bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const userId = ctx.from.id;
  
  const waitMsg = await ctx.reply('🔄 Создаю стикер...');
  
  try {
    // Создаем стикер
    const stickerMsg = await ctx.replyWithSticker({
      url: await ctx.telegram.getFileLink(photo.file_id)
    });
    
    // Сохраняем в БД
    await db.saveSticker(stickerMsg.sticker.file_id, userId);
    
    // Показываем кнопки голосования
    await ctx.reply(
      '✅ Стикер готов! Оцени его:',
      voteMenu(stickerMsg.sticker.file_id)
    );
    
    await ctx.deleteMessage(waitMsg.message_id);
  } catch (error) {
    await ctx.reply('❌ Ошибка при создании стикера', mainMenu);
  }
});

// Голосования
bot.action(/like_(.+)/, async (ctx) => {
  const fileId = ctx.match[1];
  await db.vote(fileId, 'like');
  await ctx.answerCbQuery('👍 Лайк добавлен!');
});

bot.action(/dislike_(.+)/, async (ctx) => {
  const fileId = ctx.match[1];
  await db.vote(fileId, 'dislike');
  await ctx.answerCbQuery('👎 Дизлайк добавлен!');
});

// Статистика
bot.hears('📊 Статистика', async (ctx) => {
  const result = await pool.query(
    'SELECT COUNT(*) as total_stickers FROM stickers WHERE user_id = $1',
    [ctx.from.id]
  );
  
  await ctx.reply(
    `📈 Твоя статистика:\n\n` +
    `🖼️ Создано стикеров: ${result.rows[0]?.total_stickers || 0}\n\n` +
    `Продолжай творить! ✨`,
    mainMenu
  );
});

// Топ стикеров
bot.hears('🏆 Топ стикеров', async (ctx) => {
  const result = await pool.query(`
    SELECT file_id, likes, dislikes 
    FROM stickers 
    ORDER BY likes DESC 
    LIMIT 5
  `);
  
  if (result.rows.length === 0) {
    await ctx.reply('🏆 Пока нет стикеров. Создай первый!', mainMenu);
    return;
  }
  
  let message = '🏆 Топ стикеров:\n\n';
  result.rows.forEach((sticker, i) => {
    message += `${i + 1}. 👍 ${sticker.likes} | 👎 ${sticker.dislikes}\n`;
  });
  
  await ctx.reply(message, mainMenu);
});

// Помощь
bot.hears('❓ Помощь', (ctx) => {
  ctx.reply(
    '📖 Просто отправь мне картинку!\n\n' +
    'Я создам из нее стикер и добавлю кнопки для оценки.\n\n' +
    'Форматы: JPG, PNG, WebP\n' +
    'Размер: до 5 МБ',
    mainMenu
  );
});

// === 5. WEBHOOK ДЛЯ VERCEL ===
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } else {
    res.status(200).json({ 
      status: 'Bot is running',
      timestamp: new Date().toISOString()
    });
  }
};

// === 6. ЗАПУСК ДЛЯ РАЗРАБОТКИ ===
if (process.env.NODE_ENV === 'development') {
  bot.launch();
  console.log('🤖 Бот запущен в режиме разработки');
}
