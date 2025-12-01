const { Telegraf, Markup } = require('telegraf');
const db = require('./db');

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// === КНОПОЧНЫЕ МЕНЮ ===

// Главное меню (обычная клавиатура)
const mainMenu = Markup.keyboard([
  ['🎨 Создать стикер', '📊 Моя статистика'],
  ['🏆 Топ стикеров', '⭐ Мои лучшие стикеры'],
  ['❓ Помощь']
]).resize();

// Меню голосования (инлайн клавиатура)
const getVoteMenu = (stickerId) => Markup.inlineKeyboard([
  [
    Markup.button.callback('👍', `like_${stickerId}`),
    Markup.button.callback('👎', `dislike_${stickerId}`),
    Markup.button.callback('📈 Статистика', `stats_${stickerId}`)
  ],
  [
    Markup.button.callback('🏆 Топ', 'show_top'),
    Markup.button.callback('🔄 Обновить', `refresh_${stickerId}`)
  ]
]);

// Меню действий после создания стикера
const afterStickerMenu = Markup.inlineKeyboard([
  [
    Markup.button.callback('📊 Посмотреть статистику', 'view_stats'),
    Markup.button.callback('🏆 Топ стикеров', 'view_top')
  ],
  [
    Markup.button.callback('✨ Создать еще', 'create_more'),
    Markup.button.callback('📱 Главное меню', 'main_menu')
  ]
]);

// === ОБРАБОТЧИКИ КОМАНД ===

// /start - главная команда
bot.start(async (ctx) => {
  const user = ctx.from;
  await db.saveUser(user.id, user.username, user.first_name);
  
  const welcomeText = `🎨 *Добро пожаловать в Sticker Bot!*\n\n` +
    `Я помогу тебе:\n` +
    `✅ Создать стикер из любой картинки\n` +
    `✅ Собирать оценки и рейтинги\n` +
    `✅ Смотреть статистику\n` +
    `✅ Соревноваться в топе\n\n` +
    `*Как использовать:*\n` +
    `1. Отправь мне картинку\n` +
    `2. Я создам стикер\n` +
    `3. Получай оценки от других\n\n` +
    `Выбери действие в меню ниже 👇`;
  
  await ctx.replyWithMarkdown(welcomeText, mainMenu);
});

// /help - помощь
bot.help(async (ctx) => {
  const helpText = `📚 *Помощь по боту*\n\n` +
    `*Основные команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Эта справка\n` +
    `/stats - Ваша статистика\n` +
    `/top - Топ 10 стикеров\n` +
    `/mystickers - Ваши стикеры\n\n` +
    `*Как создать стикер:*\n` +
    `1. Отправьте любое изображение\n` +
    `2. Добавьте эмодзи в подпись (по желанию)\n` +
    `3. Получите стикер с кнопками оценки\n\n` +
    `*Требования к изображениям:*\n` +
    `• Форматы: JPG, PNG, WebP\n` +
    `• Размер: до 5 МБ\n` +
    `• Рекомендуемый размер: 512×512 пикселей\n\n` +
    `*Система рейтинга:*\n` +
    `• 👍 - лайк (увеличивает рейтинг)\n` +
    `• 👎 - дизлайк (уменьшает рейтинг)\n` +
    `• 📈 - посмотреть статистику стикера\n\n` +
    `*Примечание:* Каждый пользователь может проголосовать за стикер только один раз!`;
  
  await ctx.replyWithMarkdown(helpText, mainMenu);
});

// === ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ ===

// "🎨 Создать стикер"
bot.hears('🎨 Создать стикер', async (ctx) => {
  await ctx.reply(
    '📸 *Отправь мне картинку для создания стикера!*\n\n' +
    'Можешь добавить эмодзи в подпись к фото — они станут эмодзи стикера.\n' +
    'Например: "😊" или "🔥❤️"\n\n' +
    'Поддерживаемые форматы:\n' +
    '• JPEG/JPG\n' +
    '• PNG\n' +
    '• WebP\n\n' +
    'Максимальный размер: 5 МБ',
    { parse_mode: 'Markdown' }
  );
});

// "📊 Моя статистика"
bot.hears('📊 Моя статистика', async (ctx) => {
  const stats = await db.getUserStats(ctx.from.id);
  
  const statsText = `📈 *Ваша статистика*\n\n` +
    `👤 Пользователь: ${ctx.from.first_name}\n` +
    `🆔 ID: ${ctx.from.id}\n` +
    `🖼️ Создано стикеров: ${stats.stickers_count}\n` +
    `👀 Всего просмотров: ${stats.total_views}\n` +
    `👍 Всего лайков: ${stats.total_likes}\n` +
    `📊 Средний рейтинг: ${stats.total_stickers > 0 ? 
      Math.round((stats.total_likes / (stats.total_likes + (stats.total_stickers * 2))) * 100) : 0}%\n\n` +
    `*Рекорды:*\n` +
    `• Самый популярный стикер: ${stats.total_likes > 0 ? 'Есть' : 'Пока нет'}\n` +
    `• Больше всего просмотров: ${stats.total_views > 0 ? 'Есть' : 'Пока нет'}\n\n` +
    `Продолжайте создавать крутые стикеры! 🚀`;
  
  await ctx.replyWithMarkdown(statsText, mainMenu);
});

// "🏆 Топ стикеров"
bot.hears('🏆 Топ стикеров', async (ctx) => {
  const topStickers = await db.getTopStickers(10);
  
  if (topStickers.length === 0) {
    await ctx.reply('🏆 *Топ стикеров пока пуст!*\n\nСоздайте первый стикер и станьте первым в топе! ✨', 
      { parse_mode: 'Markdown', ...mainMenu });
    return;
  }
  
  let topText = `🏆 *ТОП-10 СТИКЕРОВ*\n\n`;
  
  topStickers.forEach((sticker, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const rating = sticker.rating ? sticker.rating.toFixed(1) : '0.0';
    const creator = sticker.username ? `@${sticker.username}` : sticker.first_name || 'Аноним';
    
    topText += `${medal} *Рейтинг: ${rating}%*\n`;
    topText += `   👍 ${sticker.likes} | 👎 ${sticker.dislikes} | 👀 ${sticker.views}\n`;
    topText += `   👤 Создатель: ${creator}\n`;
    if (sticker.emoji) topText += `   😀 Эмодзи: ${sticker.emoji}\n`;
    topText += '\n';
  });
  
  await ctx.replyWithMarkdown(topText, mainMenu);
});

// "⭐ Мои лучшие стикеры"
bot.hears('⭐ Мои лучшие стикеры', async (ctx) => {
  try {
    const result = await db.pool.query(`
      SELECT s.id, s.emoji, s.likes, s.dislikes, s.views,
             ROUND(
               CASE 
                 WHEN (s.likes + s.dislikes) > 0 
                 THEN (s.likes * 1.0 / (s.likes + s.dislikes)) * 100 
                 ELSE 0 
               END, 1
             ) as rating
      FROM stickers s
      WHERE s.user_id = $1
      ORDER BY rating DESC, s.likes DESC
      LIMIT 5
    `, [ctx.from.id]);
    
    if (result.rows.length === 0) {
      await ctx.reply('📭 *У вас еще нет стикеров!*\n\nСоздайте первый стикер и он появится здесь! 🎨', 
        { parse_mode: 'Markdown', ...mainMenu });
      return;
    }
    
    let myStickersText = `⭐ *ВАШИ ЛУЧШИЕ СТИКЕРЫ*\n\n`;
    
    result.rows.forEach((sticker, index) => {
      const star = '⭐';
      myStickersText += `${star} *Стикер #${index + 1}*\n`;
      myStickersText += `   Рейтинг: ${sticker.rating}%\n`;
      myStickersText += `   👍 ${sticker.likes} | 👎 ${sticker.dislikes}\n`;
      myStickersText += `   👀 Просмотров: ${sticker.views}\n`;
      if (sticker.emoji) myStickersText += `   😀 Эмодзи: ${sticker.emoji}\n`;
      myStickersText += '\n';
    });
    
    await ctx.replyWithMarkdown(myStickersText, mainMenu);
  } catch (error) {
    console.error('Error getting user stickers:', error);
    await ctx.reply('❌ Ошибка при получении ваших стикеров', mainMenu);
  }
});

// "❓ Помощь"
bot.hears('❓ Помощь', async (ctx) => {
  await ctx.help();
});

// === ОБРАБОТКА ИЗОБРАЖЕНИЙ ===

bot.on('photo', async (ctx) => {
  try {
    const user = ctx.from;
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const emoji = ctx.message.caption || '😀';
    
    // Сохраняем пользователя
    await db.saveUser(user.id, user.username, user.first_name);
    
    // Сообщение о обработке
    const processingMsg = await ctx.reply('🔄 *Создаю стикер...*', { parse_mode: 'Markdown' });
    
    // Получаем ссылку на файл
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    // Отправляем стикер
    const stickerMsg = await ctx.replyWithSticker(
      { url: fileUrl },
      { 
        emoji: emoji.substring(0, 2),
        reply_markup: { inline_keyboard: [] }
      }
    );
    
    // Сохраняем в базу данных
    const stickerId = await db.saveSticker(stickerMsg.sticker.file_id, user.id, emoji.substring(0, 2));
    
    if (stickerId) {
      // Добавляем просмотр
      await db.addView(stickerId);
      
      // Удаляем сообщение о обработке
      await ctx.deleteMessage(processingMsg.message_id);
      
      // Отправляем меню с кнопками
      await ctx.reply(
        `✅ *Стикер успешно создан!*\n\n` +
        `📊 Теперь другие пользователи могут его оценить.\n` +
        `🎯 Эмодзи стикера: ${emoji.substring(0, 2)}\n\n` +
        `*Что дальше?*`,
        { 
          parse_mode: 'Markdown',
          reply_markup: getVoteMenu(stickerId).reply_markup
        }
      );
    } else {
      await ctx.reply('❌ Не удалось сохранить стикер в базу данных', mainMenu);
    }
    
  } catch (error) {
    console.error('Error creating sticker:', error);
    await ctx.reply(
      '❌ *Ошибка при создании стикера!*\n\n' +
      'Возможные причины:\n' +
      '• Изображение слишком большое (макс. 5 МБ)\n' +
      '• Неподдерживаемый формат\n' +
      '• Проблемы с сервером\n\n' +
      'Попробуйте другое изображение или обратитесь в поддержку.',
      { parse_mode: 'Markdown', ...mainMenu }
    );
  }
});

// === ОБРАБОТКА ИНЛАЙН-КОЛБЭКОВ ===

// Лайк
bot.action(/like_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const userId = ctx.from.id;
  
  const result = await db.vote(stickerId, userId, 'like');
  
  if (result === 'success') {
    await ctx.answerCbQuery('👍 Ваш лайк учтен!');
    
    // Обновляем статистику в сообщении
    const stats = await db.getStickerStats(stickerId);
    await ctx.editMessageText(
      `✅ *Стикер оценен!*\n\n` +
      `📊 Текущая статистика:\n` +
      `👍 Лайков: ${stats.likes}\n` +
      `👎 Дизлайков: ${stats.dislikes}\n` +
      `⭐ Рейтинг: ${stats.rating_percent}%\n\n` +
      `Спасибо за ваш голос! ❤️`,
      {
        parse_mode: 'Markdown',
        reply_markup: getVoteMenu(stickerId).reply_markup
      }
    );
  } else if (result === 'already_voted') {
    await ctx.answerCbQuery('⚠️ Вы уже голосовали за этот стикер!');
  } else❌ {
    await ctx.answerCbQuery(' Ошибка при голосовании');
  }
});

// Дизлайк
bot.action(/dislike_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const userId = ctx.from.id;
  
  const result = await db.vote(stickerId, userId, 'dislike');
  
  if (result === 'success') {
    await ctx.answerCbQuery('👎 Ваш дизлайк учтен!');
    
    // Обновляем статистику
    const stats = await db.getStickerStats(stickerId);
    await ctx.editMessageText(
      `✅ *Стикер оценен!*\n\n` +
      `📊 Текущая статистика:\n` +
      `👍 Лайков: ${stats.likes}\n` +
      `👎 Дизлайков: ${stats.dislikes}\n` +
      `⭐ Рейтинг: ${stats.rating_percent}%\n\n` +
      `Спасибо за честный отзыв!`,
      {
        parse_mode: 'Markdown',
        reply_markup: getVoteMenu(stickerId).reply_markup
      }
    );
  } else if (result === 'already_voted') {
    await ctx.answerCbQuery('⚠️ Вы уже голосовали за этот стикер!');
  } else {
    await ctx.answerCbQuery('❌ Ошибка при голосовании');
  }
});

// Показать статистику стикера
bot.action(/stats_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const stats = await db.getStickerStats(stickerId);
  
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `📊 *Детальная статистика стикера*\n\n` +
    `🆔 ID: ${stickerId}\n` +
    `👍 Лайков: ${stats.likes}\n` +
    `👎 Дизлайков: ${stats.dislikes}\n` +
    `⭐ Рейтинг: ${stats.rating_percent}%\n` +
    `👀 Просмотров: ${stats.views}\n\n` +
    `*Формула рейтинга:*\n` +
    `(лайки / (лайки + дизлайки)) × 100%\n\n` +
    `Чем выше процент, тем популярнее стикер! 🚀`
  );
});

// Обновить кнопки
bot.action(/refresh_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const stats = await db.getStickerStats(stickerId);
  
  await ctx.answerCbQuery('🔄 Статистика обновлена!');
  
  await ctx.editMessageText(
    `📊 *Текущая статистика стикера*\n\n` +
    `👍 Лайков: ${stats.likes}\n` +
    `👎 Дизлайков: ${stats.dislikes}\n` +
    `⭐ Рейтинг: ${stats.rating_percent}%\n` +
    `👀 Просмотров: ${stats.views}\n\n` +
    `Оцените стикер или посмотрите топ!`,
    {
      parse_mode: 'Markdown',
      reply_markup: getVoteMenu(stickerId).reply_markup
    }
  );
});

// Показать топ
bot.action('show_top', async (ctx) => {
  await ctx.answerCbQuery('🏆 Загружаю топ...');
  
  const topStickers = await db.getTopStickers(5);
  
  if (topStickers.length === 0) {
    await ctx.reply('🏆 *Топ стикеров пока пуст!*\n\nСоздайте стикер первым!', {
      parse_mode: 'Markdown'
    });
    return;
  }
  
  let topText = `🏆 *ТОП-5 СТИКЕРОВ*\n\n`;
  
  topStickers.forEach((sticker, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const rating = sticker.rating ? sticker.rating.toFixed(1) : '0.0';
    
    topText += `${medal} *Рейтинг: ${rating}%*\n`;
    topText += `   👍 ${sticker.likes} | 👎 ${sticker.dislikes}\n`;
    topText += `   👀 Просмотров: ${sticker.views}\n`;
    if (sticker.emoji) topText += `   😀 Эмодзи: ${sticker.emoji}\n`;
    topText += '\n';
  });
  
  await ctx.replyWithMarkdown(topText);
});

// === ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ ===

// Команда /stats
bot.command('stats', async (ctx) => {
  const stats = await db.getUserStats(ctx.from.id);
  
  await ctx.replyWithMarkdown(
    `📊 *Ваша статистика*\n\n` +
    `🖼️ Создано стикеров: ${stats.stickers_count}\n` +
    `👀 Всего просмотров: ${stats.total_views}\n` +
    `👍 Всего лайков: ${stats.total_likes}\n` +
    `📈 Активность: ${stats.total_stickers > 0 ? 'Высокая' : 'Начните создавать!'}\n\n` +
    `Продолжайте в том же духе! ✨`
  );
});

// Команда /top
bot.command('top', async (ctx) => {
  const topStickers = await db.getTopStickers(10);
  
  if (topStickers.length === 0) {
    await ctx.reply('🏆 *Топ стикеров пока пуст!*\n\nСоздайте первый стикер!', {
      parse_mode: 'Markdown'
    });
    return;
  }
  
  let topText = `🏆 *ТОП-10 СТИКЕРОВ ВСЕГО ВРЕМЕНИ*\n\n`;
  
  topStickers.forEach((sticker, index) => {
    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${index + 1}.`;
    const rating = sticker.rating ? sticker.rating.toFixed(1) : '0.0';
    const creator = sticker.username ? `@${sticker.username}` : sticker.first_name || 'Аноним';
    
    topText += `${medal} *${rating}%* (👍${sticker.likes}/👎${sticker.dislikes})\n`;
    topText += `   👤 ${creator}\n`;
    topText += '\n';
  });
  
  await ctx.replyWithMarkdown(topText);
});

// Команда /mystickers
bot.command('mystickers', async (ctx) => {
  try {
    const result = await db.pool.query(`
      SELECT COUNT(*) as count, 
             SUM(likes) as total_likes,
             SUM(views) as total_views
      FROM stickers 
      WHERE user_id = $1
    `, [ctx.from.id]);
    
    const userStats = result.rows[0];
    
    await ctx.replyWithMarkdown(
      `📂 *Ваши стикеры*\n\n` +
      `📊 Общая статистика:\n` +
      `🖼️ Количество: ${userStats.count || 0}\n` +
      `👍 Лайков: ${userStats.total_likes || 0}\n` +
      `👀 Просмотров: ${userStats.total_views || 0}\n\n` +
      `Используйте кнопку "⭐ Мои лучшие стикеры" в меню для детальной информации!`
    );
  } catch (error) {
    console.error('Error in /mystickers:', error);
    await ctx.reply('❌ Ошибка при получении информации о ваших стикерах');
  }
});

// === ОБРАБОТКА ОШИБОК ===
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}:`, err);
  ctx.reply('❌ Произошла ошибка. Пожалуйста, попробуйте позже.', mainMenu);
});

// === WEBHOOK ДЛЯ VERCEL ===
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    }
    
    // GET запрос - проверка работоспособности
    return res.status(200).json({
      status: 'Bot is running',
      timestamp: new Date().toISOString(),
      node_version: process.version,
      platform: 'Vercel Node.js 24',
      database: 'Neon PostgreSQL'
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// === ЛОКАЛЬНЫЙ ЗАПУСК ===
if (process.env.NODE_ENV === 'development' && require.main === module) {
  bot.launch().then(() => {
    console.log('🤖 Бот запущен в режиме разработки');
    console.log('📊 База данных подключена');
    console.log('🔗 Используйте ngrok для тестирования webhook');
  });
  
  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
