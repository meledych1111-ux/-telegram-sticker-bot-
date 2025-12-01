const { Telegraf, Markup } = require('telegraf');
const db = require('./db');

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Сохраняем данные пользователя
const saveUserInfo = async (ctx) => {
  const user = ctx.from;
  await db.saveUser(user.id, user.username, user.first_name);
};

// Главное меню
const mainMenu = Markup.keyboard([
  ['📊 Моя статистика', '🏆 Топ стикеров'],
  ['✨ Создать стикер', '❓ Помощь']
]).resize();

// Меню голосования
const voteMenu = (stickerId) => Markup.inlineKeyboard([
  [
    Markup.button.callback('👍', `like_${stickerId}`),
    Markup.button.callback('👎', `dislike_${stickerId}`),
    Markup.button.callback('📊 Статистика', `stats_${stickerId}`)
  ]
]);

// Команда /start
bot.start(async (ctx) => {
  await saveUserInfo(ctx);
  
  await ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n\n` +
    'Я бот для создания стикеров с системой рейтингов! 🎯\n\n' +
    '📌 Возможности:\n' +
    '• Создавать стикеры из изображений\n' + 
    '• Ставить оценки стикерам\n' +
    '• Смотреть топ лучших стикеров\n' +
    '• Вести свою статистику\n\n' +
    'Отправь мне картинку или используй меню ниже ⬇️',
    mainMenu
  );
});

// Команда /help
bot.help(async (ctx) => {
  await ctx.reply(
    '📖 **Как использовать бота:**\n\n' +
    '1. **Создание стикера:**\n' +
    '   Просто отправь мне любое изображение (PNG, JPG, WebP)\n' +
    '   Добавь эмодзи в подпись для стикера (опционально)\n\n' +
    '2. **Голосование:**\n' +
    '   Под каждым стикером есть кнопки 👍 и 👎\n' +
    '   Можешь оценить любой стикер\n\n' +
    '3. **Статистика:**\n' +
    '   • /stats - твоя статистика\n' +
    '   • /top - лучшие стикеры\n\n' +
    '4. **Требования к изображениям:**\n' +
    '   • Размер: до 5 МБ\n' +
    '   • Формат: PNG, JPEG, WebP\n' +
    '   • Оптимальный размер: 512x512 px\n\n' +
    '📱 **Основные команды:**\n' +
    '/start - Главное меню\n' +
    '/help - Эта справка\n' +
    '/stats - Твоя статистика\n' +
    '/top - Топ стикеров\n' +
    '/sticker - Создать стикер',
    mainMenu
  );
});

// Обработка текстовых сообщений
bot.hears('📊 Моя статистика', async (ctx) => {
  await saveUserInfo(ctx);
  const stats = await db.getUserStats(ctx.from.id);
  
  await ctx.reply(
    `📈 **Твоя статистика:**\n\n` +
    `🖼️ Создано стикеров: ${stats.stickers_count}\n` +
    `👀 Всего просмотров: ${stats.total_views}\n` +
    `❤️ Всего лайков: ${stats.total_likes}\n` +
    `📊 Рейтинг активности: ${Math.min(100, Math.round(stats.total_likes / Math.max(1, stats.total_views) * 100))}%\n\n` +
    `Продолжай создавать крутые стикеры! ✨`,
    mainMenu
  );
});

bot.hears('🏆 Топ стикеров', async (ctx) => {
  const topStickers = await db.getTopStickers(5);
  
  if (topStickers.length === 0) {
    await ctx.reply('🏆 Пока нет стикеров с рейтингами. Будь первым!', mainMenu);
    return;
  }
  
  let message = '🏆 **Топ стикеров:**\n\n';
  
  topStickers.forEach((sticker, index) => {
    const userInfo = sticker.username 
      ? `@${sticker.username}` 
      : sticker.first_name;
    
    message += `${index + 1}. Рейтинг: ${sticker.rating.toFixed(1)}%\n`;
    message += `   👍 ${sticker.likes} | 👎 ${sticker.dislikes} | 👀 ${sticker.views}\n`;
    message += `   👤 ${userInfo}\n\n`;
  });
  
  await ctx.reply(message, mainMenu);
});

bot.hears('✨ Создать стикер', async (ctx) => {
  await ctx.reply(
    '📸 Отправь мне картинку для создания стикера!\n\n' +
    'Можно добавить эмодзи в подпись к фото.\n' +
    'Пример: "❤️🔥" или "😀"',
    Markup.removeKeyboard()
  );
});

bot.hears('❓ Помощь', (ctx) => ctx.help());

// Обработка изображений
bot.on('photo', async (ctx) => {
  try {
    await saveUserInfo(ctx);
    
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const emoji = ctx.message.caption || '😀';
    const userId = ctx.from.id;
    
    // Отправляем сообщение о обработке
    const processingMsg = await ctx.reply('🔄 Создаю стикер...');
    
    // Получаем файл
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    // Создаем стикер
    const stickerMsg = await ctx.replyWithSticker(
      { url: fileUrl },
      { emoji: emoji.substring(0, 2) }
    );
    
    // Сохраняем в базу
    const stickerId = await db.saveSticker(
      stickerMsg.sticker.file_id,
      userId,
      emoji.substring(0, 2)
    );
    
    if (stickerId) {
      // Добавляем кнопки голосования
      await ctx.reply(
        '✅ Стикер создан!\n\n' +
        'Оцени его или посмотри статистику:',
        voteMenu(stickerId)
      );
      
      // Увеличиваем просмотры
      await db.addView(stickerId);
    }
    
    // Удаляем сообщение о обработке
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    
  } catch (error) {
    console.error('Error creating sticker:', error);
    await ctx.reply(
      '❌ Не удалось создать стикер. Возможно:\n' +
      '• Изображение слишком большое\n' +
      '• Неподдерживаемый формат\n' +
      '• Проблемы с сервером\n\n' +
      'Попробуй другое изображение!',
      mainMenu
    );
  }
});

// Обработка документов (изображений)
bot.on('document', async (ctx) => {
  const document = ctx.message.document;
  const mimeType = document.mime_type;
  
  if (!mimeType || !mimeType.startsWith('image/')) {
    await ctx.reply(
      '⚠️ Пожалуйста, отправь изображение (PNG, JPG, WebP)\n' +
      'Максимальный размер: 5 МБ',
      mainMenu
    );
    return;
  }
  
  if (document.file_size > 5 * 1024 * 1024) {
    await ctx.reply('⚠️ Файл слишком большой. Максимум 5 МБ', mainMenu);
    return;
  }
  
  // Обрабатываем как фото
  ctx.message.photo = [{ file_id: document.file_id }];
  bot.handleUpdate(ctx.update);
});

// Обработка голосований
bot.action(/like_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const userId = ctx.from.id;
  
  const result = await db.vote(stickerId, userId, 'like');
  
  if (result === 'success') {
    await ctx.answerCbQuery('👍 Ваш лайк учтен!');
    await updateVoteButtons(ctx, stickerId);
  } else if (result === 'already_voted') {
    await ctx.answerCbQuery('⚠️ Вы уже голосовали за этот стикер');
  } else {
    await ctx.answerCbQuery('❌ Ошибка при голосовании');
  }
});

bot.action(/dislike_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const userId = ctx.from.id;
  
  const result = await db.vote(stickerId, userId, 'dislike');
  
  if (result === 'success') {
    await ctx.answerCbQuery('👎 Ваш дизлайк учтен!');
    await updateVoteButtons(ctx, stickerId);
  } else if (result === 'already_voted') {
    await ctx.answerCbQuery('⚠️ Вы уже голосовали за этот стикер');
  } else {
    await ctx.answerCbQuery('❌ Ошибка при голосовании');
  }
});

bot.action(/stats_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const stats = await db.getStickerStats(stickerId);
  
  await ctx.answerCbQuery();
  await ctx.reply(
    `📊 **Статистика стикера:**\n\n` +
    `👍 Лайки: ${stats.likes}\n` +
    `👎 Дизлайки: ${stats.dislikes}\n` +
    `👀 Просмотры: ${stats.views}\n` +
    `⭐ Рейтинг: ${stats.rating_percent}%\n\n` +
    `Спасибо за интерес! ❤️`
  );
});

// Функция обновления кнопок голосования
async function updateVoteButtons(ctx, stickerId) {
  try {
    const stats = await db.getStickerStats(stickerId);
    
    const newKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(`👍 ${stats.likes}`, `like_${stickerId}`),
        Markup.button.callback(`👎 ${stats.dislikes}`, `dislike_${stickerId}`),
        Markup.button.callback('📊 Статистика', `stats_${stickerId}`)
      ]
    ]);
    
    await ctx.editMessageReplyMarkup(newKeyboard.reply_markup);
  } catch (error) {
    console.error('Error updating buttons:', error);
  }
}

// Команда /stats
bot.command('stats', async (ctx) => {
  await saveUserInfo(ctx);
  const stats = await db.getUserStats(ctx.from.id);
  
  await ctx.replyWithHTML(
    `<b>📊 Ваша статистика:</b>\n\n` +
    `<code>┌─────────────────────┐\n` +
    `│ 🖼️  Стикеров: ${stats.stickers_count.toString().padEnd(6)} │\n` +
    `│ 👀  Просмотров: ${stats.total_views.toString().padEnd(4)} │\n` +
    `│ ❤️  Лайков: ${stats.total_likes.toString().padEnd(7)} │\n` +
    `└─────────────────────┘</code>\n\n` +
    `Продолжайте в том же духе! 🚀`
  );
});

// Команда /top
bot.command('top', async (ctx) => {
  const topStickers = await db.getTopStickers(10);
  
  if (topStickers.length === 0) {
    await ctx.reply('🏆 Топ стикеров пока пуст. Будьте первым!');
    return;
  }
  
  let message = '<b>🏆 ТОП-10 СТИКЕРОВ</b>\n\n';
  
  topStickers.forEach((sticker, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '▫️';
    const rating = sticker.rating.toFixed(1);
    
    message += `${medal} <b>${index + 1}.</b> Рейтинг: <code>${rating}%</code>\n`;
    message += `   👍 ${sticker.likes} | 👎 ${sticker.dislikes} | 👀 ${sticker.views}\n`;
    
    if (sticker.username) {
      message += `   👤 @${sticker.username}\n`;
    }
    message += '\n';
  });
  
  await ctx.replyWithHTML(message);
});

// Команда /sticker
bot.command('sticker', async (ctx) => {
  await ctx.reply(
    'Отправьте мне изображение для создания стикера!\n\n' +
    'Можно добавить эмодзи в подпись.\n' +
    'Пример: "❤️" или "😂"',
    Markup.removeKeyboard()
  );
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error:`, err);
  ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
});

// Webhook для Vercel
module.exports = async (req, res) => {
  try {
    // Проверка токена (опционально)
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } else if (req.method === 'GET') {
      // Health check
      res.status(200).json({ 
        status: 'Bot is running',
        node: process.version,
        platform: 'Vercel Node.js 24',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Локальный запуск (для разработки)
if (process.env.NODE_ENV === 'development') {
  bot.launch().then(() => {
    console.log('🤖 Bot started in development mode');
    console.log('📊 Database connected');
  });
}
