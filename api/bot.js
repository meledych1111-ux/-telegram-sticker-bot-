const { Telegraf, Markup } = require('telegraf');
const db = require('./db'); // Импортируем модуль базы данных

console.log(`🚀 Sticker Bot запущен на Node.js ${process.version}`);

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// ==================== КНОПОЧНЫЕ МЕНЮ ====================

// Главное меню
const mainMenu = Markup.keyboard([
  ['🎨 Создать стикер'],
  ['📊 Моя статистика', '🏆 Топ стикеров'],
  ['❓ Помощь']
]).resize();

// Меню голосования
const getVoteMenu = (stickerId) => Markup.inlineKeyboard([
  [
    Markup.button.callback('👍', `like_${stickerId}`),
    Markup.button.callback('👎', `dislike_${stickerId}`),
    Markup.button.callback('📊', `stats_${stickerId}`)
  ]
]);

// ==================== КОМАНДЫ БОТА ====================

// /start
bot.start(async (ctx) => {
  const user = ctx.from;
  await db.saveUser(user.id, user.username, user.first_name);
  
  await ctx.replyWithMarkdown(
    `👋 *Привет, ${user.first_name}!*\n\n` +
    `Я бот для создания стикеров с рейтингами!\n\n` +
    `*Что я умею:*\n` +
    `🎨 Создавать стикеры из картинок\n` +
    `⭐ Собирать оценки (лайки/дизлайки)\n` +
    `📊 Показывать статистику\n` +
    `🏆 Вести топ лучших стикеров\n\n` +
    `*Просто отправь мне картинку и начнем!*`,
    mainMenu
  );
});

// /help
bot.help(async (ctx) => {
  await ctx.replyWithMarkdown(
    `📖 *Как использовать бота:*\n\n` +
    `1. *Отправь картинку* - я создам из нее стикер\n` +
    `2. *Добавь эмодзи в подпись* (по желанию)\n` +
    `3. *Получи стикер* с кнопками для оценки\n\n` +
    `*Команды:*\n` +
    `/start - Главное меню\n` +
    `/stats - Твоя статистика\n` +
    `/top - Топ стикеров\n\n` +
    `*Форматы:* JPG, PNG, WebP\n` +
    `*Размер:* до 5 МБ`
  );
});

// ==================== ОБРАБОТКА КНОПОК ====================

// Создать стикер
bot.hears('🎨 Создать стикер', async (ctx) => {
  await ctx.reply(
    '📸 Отправь мне любую картинку!\n' +
    'Можно добавить эмодзи в подпись.\n\n' +
    'Например: "😊" или "❤️🔥"\n\n' +
    'Поддерживаются: JPG, PNG, WebP\n' +
    'Максимальный размер: 5 МБ'
  );
});

// Моя статистика
bot.hears('📊 Моя статистика', async (ctx) => {
  const stats = await db.getUserStats(ctx.from.id);
  
  await ctx.replyWithMarkdown(
    `📈 *Твоя статистика*\n\n` +
    `🖼️ Создано стикеров: ${stats.stickers_count}\n` +
    `👀 Всего просмотров: ${stats.total_views}\n` +
    `👍 Всего лайков: ${stats.total_likes}\n\n` +
    `${stats.total_stickers > 0 ? 'Продолжай в том же духе! 🚀' : 'Создай первый стикер! 🎨'}`
  );
});

// Топ стикеров
bot.hears('🏆 Топ стикеров', async (ctx) => {
  const topStickers = await db.getTopStickers(5);
  
  if (topStickers.length === 0) {
    await ctx.reply('🏆 Пока нет стикеров. Будь первым! 🎨', mainMenu);
    return;
  }
  
  let message = '🏆 *ТОП-5 СТИКЕРОВ*\n\n';
  
  topStickers.forEach((sticker, index) => {
    const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] || `${index + 1}.`;
    const rating = sticker.rating?.toFixed(1) || '0.0';
    
    message += `${medal} Рейтинг: *${rating}%*\n`;
    message += `   👍 ${sticker.likes} | 👎 ${sticker.dislikes}\n`;
    message += `   👀 ${sticker.views} просмотров\n`;
    if (sticker.username) {
      message += `   👤 @${sticker.username}\n`;
    }
    message += '\n';
  });
  
  await ctx.replyWithMarkdown(message, mainMenu);
});

// Помощь
bot.hears('❓ Помощь', async (ctx) => {
  await ctx.help();
});

// ==================== ОБРАБОТКА ИЗОБРАЖЕНИЙ ====================

bot.on('photo', async (ctx) => {
  try {
    const user = ctx.from;
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const emoji = ctx.message.caption || '😀';
    
    // Сохраняем пользователя
    await db.saveUser(user.id, user.username, user.first_name);
    
    // Сообщение о обработке
    const waitMsg = await ctx.reply('🔄 Создаю стикер...');
    
    // Получаем файл
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    // Создаем стикер
    const stickerMsg = await ctx.replyWithSticker(
      { url: fileUrl },
      { emoji: emoji.substring(0, 2) }
    );
    
    // Сохраняем в базу
    const stickerId = await db.saveSticker(stickerMsg.sticker.file_id, user.id, emoji.substring(0, 2));
    
    if (stickerId) {
      // Добавляем просмотр
      await db.addView(stickerId);
      
      // Удаляем сообщение о обработке
      await ctx.deleteMessage(waitMsg.message_id);
      
      // Отправляем кнопки голосования
      await ctx.reply(
        '✅ Стикер готов!\n\n' +
        'Теперь другие могут его оценить:',
        getVoteMenu(stickerId)
      );
    }
    
  } catch (error) {
    console.error('Ошибка создания стикера:', error);
    await ctx.reply(
      '❌ Не удалось создать стикер.\n' +
      'Проверь размер и формат картинки.\n' +
      'Максимум: 5 МБ, форматы: JPG/PNG/WebP',
      mainMenu
    );
  }
});

// ==================== ГОЛОСОВАНИЕ ====================

// Лайк
bot.action(/like_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const userId = ctx.from.id;
  
  const result = await db.vote(stickerId, userId, 'like');
  
  if (result === 'success') {
    await ctx.answerCbQuery('👍 Лайк добавлен!');
    await updateStickerStats(ctx, stickerId);
  } else if (result === 'already_voted') {
    await ctx.answerCbQuery('⚠️ Ты уже голосовал за этот стикер');
  } else {
    await ctx.answerCbQuery('❌ Ошибка');
  }
});

// Дизлайк
bot.action(/dislike_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const userId = ctx.from.id;
  
  const result = await db.vote(stickerId, userId, 'dislike');
  
  if (result === 'success') {
    await ctx.answerCbQuery('👎 Дизлайк добавлен!');
    await updateStickerStats(ctx, stickerId);
  } else if (result === 'already_voted') {
    await ctx.answerCbQuery('⚠️ Ты уже голосовал за этот стикер');
  } else {
    await ctx.answerCbQuery('❌ Ошибка');
  }
});

// Статистика стикера
bot.action(/stats_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const stats = await db.getStickerStats(stickerId);
  
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `📊 *Статистика стикера*\n\n` +
    `👍 Лайков: ${stats.likes}\n` +
    `👎 Дизлайков: ${stats.dislikes}\n` +
    `⭐ Рейтинг: ${stats.rating_percent}%\n` +
    `👀 Просмотров: ${stats.views}`
  );
});

// Функция обновления статистики
async function updateStickerStats(ctx, stickerId) {
  try {
    const stats = await db.getStickerStats(stickerId);
    const keyboard = getVoteMenu(stickerId).reply_markup;
    
    await ctx.editMessageText(
      `📊 Статистика обновлена:\n` +
      `👍 ${stats.likes} | 👎 ${stats.dislikes}\n` +
      `⭐ Рейтинг: ${stats.rating_percent}%\n\n` +
      `Оцени стикер:`,
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('Ошибка обновления статистики:', error);
  }
}

// ==================== ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ ====================

// /stats
bot.command('stats', async (ctx) => {
  const stats = await db.getUserStats(ctx.from.id);
  await ctx.replyWithMarkdown(
    `📊 *Ваша статистика*\n\n` +
    `🖼️ Стикеров: ${stats.stickers_count}\n` +
    `👀 Просмотров: ${stats.total_views}\n` +
    `👍 Лайков: ${stats.total_likes}`
  );
});

// /top
bot.command('top', async (ctx) => {
  const topStickers = await db.getTopStickers(10);
  
  if (topStickers.length === 0) {
    await ctx.reply('🏆 Пока нет стикеров в топе. Создай первый!');
    return;
  }
  
  let message = '🏆 *ТОП-10 СТИКЕРОВ*\n\n';
  
  topStickers.forEach((sticker, index) => {
    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
    const rating = sticker.rating?.toFixed(1) || '0.0';
    
    message += `${medal} *${rating}%* (👍${sticker.likes}/👎${sticker.dislikes})\n`;
  });
  
  await ctx.replyWithMarkdown(message);
});

// ==================== WEBHOOK ДЛЯ VERCEL ====================

module.exports = async (req, res) => {
  try {
    // Health check
    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'Bot is running',
        node_version: process.version,
        platform: 'Vercel Node.js 20.x',
        timestamp: new Date().toISOString(),
        database: 'Neon PostgreSQL'
      });
    }
    
    // Обработка webhook от Telegram
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ==================== ЛОКАЛЬНЫЙ ЗАПУСК ====================

if (process.env.NODE_ENV === 'development' && require.main === module) {
  bot.launch().then(() => {
    console.log('🤖 Бот запущен в режиме разработки');
    console.log('📊 База данных подключена');
  });
  
  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
