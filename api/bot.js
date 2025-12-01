require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const db = require('../lib/database');
const StickerManager = require('../lib/sticker-manager');
const cache = require('../lib/cache');
const config = require('../config/constants');

// Проверка переменных окружения
if (!process.env.BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required!');
  process.exit(1);
}

// Инициализация
const bot = new Telegraf(process.env.BOT_TOKEN);
const stickerManager = new StickerManager(process.env.BOT_TOKEN);

// Настройка сессии
bot.use(session({
  ttl: config.SESSION.TTL,
  getSessionKey: (ctx) => ctx.from?.id.toString()
}));

// Инициализация сессии по умолчанию
bot.use((ctx, next) => {
  if (!ctx.session) {
    ctx.session = {
      step: 'idle',
      photoFileId: null,
      selectedEffect: config.EFFECTS.NONE,
      selectedFrame: config.FRAMES.NONE,
      textToAdd: null,
      textPosition: config.TEXT_POSITIONS.BOTTOM,
      processing: false,
      lastActivity: Date.now()
    };
  }
  ctx.session.lastActivity = Date.now();
  return next();
});

// ========== КЛАВИАТУРЫ ==========
const mainKeyboard = Markup.keyboard([
  ['🎨 Создать стикер', '⭐ Мой профиль'],
  ['🏆 Топ недели', '🔥 Тренды'],
  ['🎲 Случайный', '❓ Помощь']
]).resize();

const effectsKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('⚫ Ч/Б', 'effect_grayscale'),
    Markup.button.callback('🟤 Сепия', 'effect_sepia')
  ],
  [
    Markup.button.callback('🌈 Неон', 'effect_neon'),
    Markup.button.callback('✨ Перламутр', 'effect_pearl')
  ],
  [
    Markup.button.callback('🎨 Градиент', 'effect_gradient'),
    Markup.button.callback('🌀 Пиксели', 'effect_pixelate')
  ],
  [
    Markup.button.callback('📜 Винтаж', 'effect_vintage'),
    Markup.button.callback('💫 Свечение', 'effect_glow')
  ],
  [
    Markup.button.callback('🔄 Инверсия', 'effect_invert'),
    Markup.button.callback('✏️ Эскиз', 'effect_sketch')
  ],
  [
    Markup.button.callback('➡️ Далее', 'next_to_frames')
  ]
]);

const framesKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔵 Круг', 'frame_circle'),
    Markup.button.callback('💝 Сердце', 'frame_heart')
  ],
  [
    Markup.button.callback('⭐ Звезда', 'frame_star'),
    Markup.button.callback('🔲 Скругл.', 'frame_rounded')
  ],
  [
    Markup.button.callback('💎 Алмаз', 'frame_diamond'),
    Markup.button.callback('⬢ Шестиуг.', 'frame_hexagon')
  ],
  [
    Markup.button.callback('☁️ Облако', 'frame_cloud'),
    Markup.button.callback('📐 Без рамки', 'frame_none')
  ],
  [
    Markup.button.callback('➡️ Далее', 'next_to_text')
  ]
]);

const textKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('📝 Добавить текст', 'add_text'),
    Markup.button.callback('❌ Без текста', 'skip_text')
  ],
  [
    Markup.button.callback('⬆️ Вверху', 'text_top'),
    Markup.button.callback('⏺️ По центру', 'text_center'),
    Markup.button.callback('⬇️ Внизу', 'text_bottom')
  ],
  [
    Markup.button.callback('🚀 Создать!', 'create_sticker')
  ]
]);

const voteKeyboard = (fileId, likes = 0) => Markup.inlineKeyboard([
  [
    Markup.button.callback(`👍 ${likes}`, `vote_like_${fileId}`),
    Markup.button.callback('👎', `vote_dislike_${fileId}`)
  ],
  [
    Markup.button.callback('📊 Статистика', `stats_${fileId}`),
    Markup.button.callback('🎨 Новый', 'new_sticker')
  ]
]);

// ========== КОМАНДЫ ==========
bot.start(async (ctx) => {
  await db.createUser(ctx.from);
  const user = await db.getUser(ctx.from.id);
  
  await ctx.replyWithPhoto(
    'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&q=80',
    {
      caption: config.MESSAGES.WELCOME + `\n\n` +
               `👤 *Твой профиль:*\n` +
               `⭐ Рейтинг: ${user.rating || 100}\n` +
               `🎨 Стикеров: ${user.stickers_created || 0}\n` +
               `📊 Уровень: ${Math.floor((user.rating || 100) / 100)}`,
      parse_mode: 'Markdown',
      ...mainKeyboard
    }
  );
});

bot.help((ctx) => {
  ctx.reply(config.MESSAGES.HELP, {
    parse_mode: 'Markdown',
    ...mainKeyboard
  });
});

bot.command('create', (ctx) => {
  ctx.session.step = 'awaiting_photo';
  ctx.reply(
    '📸 *Отправь мне фото для создания стикера!*\n\n' +
    'Поддерживаемые форматы:\n' +
    '• JPG, PNG, WebP\n' +
    '• Макс. размер: 10 MB\n\n' +
    '_Лучше всего подходят квадратные фото_',
    { parse_mode: 'Markdown' }
  );
});

bot.command('profile', async (ctx) => {
  const stats = await db.getUserStats(ctx.from.id);
  const rank = await db.getUserRank(ctx.from.id);
  
  const message = `
🏆 *Твой профиль*

👤 *Имя:* ${ctx.from.first_name} ${ctx.from.last_name || ''}
⭐ *Рейтинг:* ${stats.rating || 100}
📊 *Ранг:* #${rank || '?'}
🎨 *Стикеров:* ${stats.stickers_created || 0}
👍 *Лайков:* ${stats.total_likes || 0}
📈 *Средний рейтинг:* ${Math.round((stats.avg_likes || 0) * 10) / 10}

*Уровень:* ${Math.floor((stats.rating || 100) / 100)} ⭐
*До след. уровня:* ${100 - ((stats.rating || 100) % 100)} очков
  `;
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainKeyboard
  });
});

bot.command('top', async (ctx) => {
  const topStickers = await db.getTopStickers(config.PAGINATION.TOP_STICKERS);
  
  if (topStickers.length === 0) {
    return ctx.reply('😢 Пока нет стикеров. Будь первым!', mainKeyboard);
  }
  
  let message = '🏆 *Топ стикеров недели*\n\n';
  
  topStickers.forEach((sticker, index) => {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const username = sticker.username || sticker.first_name || 'Аноним';
    const engagement = sticker.popularity ? Math.round(sticker.popularity) : 0;
    
    message += `${medals[index] || '🎨'} @${username}\n`;
    message += `   👍 ${sticker.likes} • 📊 ${engagement}%\n`;
    message += `   ✨ ${sticker.effect || 'без эффекта'}\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainKeyboard
  });
});

bot.command('rating', async (ctx) => {
  const topUsers = await db.getTopUsers(config.PAGINATION.TOP_USERS);
  
  let message = '👑 *Топ пользователей*\n\n';
  
  topUsers.forEach((user, index) => {
    const medals = ['👑', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const username = user.username || user.first_name || 'Аноним';
    
    message += `${medals[index] || '👤'} *${username}*\n`;
    message += `   ⭐ Рейтинг: ${user.rating}\n`;
    message += `   🎨 Стикеров: ${user.sticker_count || 0}\n`;
    message += `   👍 Лайков: ${user.total_likes || 0}\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainKeyboard
  });
});

bot.command('trending', async (ctx) => {
  const trending = await db.getTrendingStickers(config.PAGINATION.TRENDING);
  
  if (trending.length === 0) {
    return ctx.reply('😢 Пока нет трендов. Создай стикер!', mainKeyboard);
  }
  
  let message = '🔥 *Тренды сейчас*\n\n';
  
  trending.forEach((sticker, index) => {
    const fires = ['🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥'];
    const username = sticker.username || sticker.first_name || 'Аноним';
    const trendScore = Math.round((sticker.trend_score || 0) * 100);
    
    message += `${fires[index] || '📈'} ${sticker.effect || 'Без эффекта'}\n`;
    message += `   👤 @${username}\n`;
    message += `   📈 Тренд: ${trendScore}%\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainKeyboard
  });
});

// ========== ОБРАБОТКА СООБЩЕНИЙ ==========
bot.hears('🎨 Создать стикер', (ctx) => {
  ctx.session.step = 'awaiting_photo';
  ctx.reply(
    '📸 *Отправь мне фото для создания стикера!*\n\n' +
    'Поддерживаемые форматы:\n' +
    '• JPG, PNG, WebP\n' +
    '• Макс. размер: 10 MB\n\n' +
    '_Лучше всего подходят квадратные фото_',
    { parse_mode: 'Markdown' }
  );
});

bot.hears('⭐ Мой профиль', async (ctx) => {
  await ctx.reply('Загружаю профиль... ⏳');
  ctx.telegram.callApi('getMe').then(async (botInfo) => {
    const stats = await db.getUserStats(ctx.from.id);
    const rank = await db.getUserRank(ctx.from.id);
    
    const message = `
🏆 *Твой профиль*

👤 *Имя:* ${ctx.from.first_name} ${ctx.from.last_name || ''}
⭐ *Рейтинг:* ${stats.rating || 100}
📊 *Ранг:* #${rank || '?'}
🎨 *Стикеров:* ${stats.stickers_created || 0}
👍 *Лайков:* ${stats.total_likes || 0}
📈 *Средний рейтинг:* ${Math.round((stats.avg_likes || 0) * 10) / 10}

*Уровень:* ${Math.floor((stats.rating || 100) / 100)} ⭐
*До след. уровня:* ${100 - ((stats.rating || 100) % 100)} очков

🤖 *Бот:* @${botInfo.username}
    `;
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...mainKeyboard
    });
  });
});

bot.hears('🏆 Топ недели', async (ctx) => {
  await ctx.reply('Загружаю топ... ⏳');
  await ctx.replyWithChatAction('typing');
  
  const topStickers = await db.getTopStickers(config.PAGINATION.TOP_STICKERS);
  
  if (topStickers.length === 0) {
    return ctx.reply('😢 Пока нет стикеров. Будь первым!', mainKeyboard);
  }
  
  // Отправляем первые 3 стикера
  for (let i = 0; i < Math.min(3, topStickers.length); i++) {
    const sticker = topStickers[i];
    try {
      await ctx.replyWithPhoto(sticker.file_id, {
        caption: `🏆 #${i + 1} • 👍 ${sticker.likes}\n` +
                 `👤 ${sticker.username || sticker.first_name}`,
        reply_markup: voteKeyboard(sticker.file_id, sticker.likes).reply_markup
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error sending top sticker:', error);
    }
  }
  
  if (topStickers.length > 3) {
    await ctx.reply(
      `И еще ${topStickers.length - 3} стикеров в топе!\n` +
      `Используй /top для полного списка`,
      mainKeyboard
    );
  }
});

bot.hears('🔥 Тренды', async (ctx) => {
  const trending = await db.getTrendingStickers(config.PAGINATION.TRENDING);
  
  if (trending.length === 0) {
    return ctx.reply('😢 Пока нет трендов. Создай стикер!', mainKeyboard);
  }
  
  let message = '🔥 *Тренды сейчас*\n\n';
  
  trending.slice(0, 5).forEach((sticker, index) => {
    const fires = ['🔥', '🔥', '🔥', '🔥', '🔥'];
    const username = sticker.username || sticker.first_name || 'Аноним';
    const trendScore = Math.round((sticker.trend_score || 0) * 100);
    
    message += `${fires[index] || '📈'} ${sticker.effect || 'Без эффекта'}\n`;
    message += `   👤 @${username}\n`;
    message += `   📈 Тренд: ${trendScore}%\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainKeyboard
  });
});

bot.hears('🎲 Случайный', async (ctx) => {
  const stickers = await db.getTopStickers(50);
  
  if (stickers.length === 0) {
    return ctx.reply('😢 Пока нет стикеров. Создай первый!', mainKeyboard);
  }
  
  const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
  
  try {
    await ctx.replyWithPhoto(randomSticker.file_id, {
      caption: `🎲 *Случайный стикер*\n\n` +
               `👤 Автор: @${randomSticker.username || 'anon'}\n` +
               `✨ Эффект: ${randomSticker.effect || 'нет'}\n` +
               `👍 Лайков: ${randomSticker.likes}\n\n` +
               `_Оцени стикер кнопками ниже 👇_`,
      parse_mode: 'Markdown',
      reply_markup: voteKeyboard(randomSticker.file_id, randomSticker.likes).reply_markup
    });
  } catch (error) {
    console.error('Error sending random sticker:', error);
    ctx.reply('❌ Не удалось загрузить стикер', mainKeyboard);
  }
});

bot.hears('❓ Помощь', (ctx) => {
  ctx.reply(config.MESSAGES.HELP, {
    parse_mode: 'Markdown',
    ...mainKeyboard
  });
});

// ========== ОБРАБОТКА ФОТО ==========
bot.on('photo', async (ctx) => {
  if (ctx.session.step !== 'awaiting_photo') {
    return;
  }
  
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.session.photoFileId = photo.file_id;
    ctx.session.step = 'choosing_effect';
    
    // Получаем превью фото
    const file = await stickerManager.getFile(photo.file_id);
    const fileUrl = await stickerManager.getFileUrl(photo.file_id);
    
    await ctx.replyWithPhoto(
      { url: fileUrl },
      {
        caption: '✅ *Фото получено!*\n\nВыбери эффект для стикера:',
        parse_mode: 'Markdown',
        ...effectsKeyboard
      }
    );
  } catch (error) {
    console.error('Error processing photo:', error);
    ctx.reply('❌ Ошибка при обработке фото', mainKeyboard);
    ctx.session.step = 'idle';
  }
});

// ========== ОБРАБОТКА КНОПОК ==========
// Выбор эффекта
bot.action(/effect_(.+)/, async (ctx) => {
  if (ctx.session.step !== 'choosing_effect') {
    return ctx.answerCbQuery('❌ Сначала отправь фото');
  }
  
  const effect = ctx.match[1];
  ctx.session.selectedEffect = effect;
  
  await ctx.answerCbQuery(`✅ Выбран: ${effect}`);
  
  // Показываем предпросмотр с эффектом
  try {
    const fileUrl = await stickerManager.getFileUrl(ctx.session.photoFileId);
    const imageBuffer = await require('../lib/image-processor').downloadImage(fileUrl);
    const preview = await require('../lib/image-processor').createPreview(imageBuffer, effect);
    
    await ctx.editMessageMedia({
      type: 'photo',
      media: { source: preview },
      caption: `✨ *Эффект: ${effect}*\n\nВыбери рамку для стикера:`,
      parse_mode: 'Markdown'
    }, framesKeyboard);
  } catch (error) {
    console.error('Error showing effect preview:', error);
    await ctx.answerCbQuery('❌ Ошибка предпросмотра');
  }
});

// Выбор рамки
bot.action(/frame_(.+)/, async (ctx) => {
  if (!ctx.session.selectedEffect) {
    return ctx.answerCbQuery('❌ Сначала выбери эффект');
  }
  
  const frame = ctx.match[1];
  ctx.session.selectedFrame = frame;
  
  await ctx.answerCbQuery(`✅ Выбрана рамка: ${frame}`);
  
  // Показываем предпросмотр с рамкой
  try {
    const fileUrl = await stickerManager.getFileUrl(ctx.session.photoFileId);
    const imageBuffer = await require('../lib/image-processor').downloadImage(fileUrl);
    const imageProcessor = require('../lib/image-processor');
    
    const preview = await imageProcessor.createSticker(imageBuffer, {
      effect: ctx.session.selectedEffect,
      frame: frame,
      text: null
    });
    
    await ctx.editMessageMedia({
      type: 'photo',
      media: { source: preview },
      caption: `🖼️ *Рамка: ${frame}*\n\nДобавить текст к стикеру?`,
      parse_mode: 'Markdown'
    }, textKeyboard);
  } catch (error) {
    console.error('Error showing frame preview:', error);
    await ctx.answerCbQuery('❌ Ошибка предпросмотра');
  }
});

// Навигация
bot.action('next_to_frames', async (ctx) => {
  if (!ctx.session.selectedEffect) {
    return ctx.answerCbQuery('❌ Сначала выбери эффект');
  }
  
  await ctx.editMessageCaption('Выбери рамку для стикера:', framesKeyboard);
  await ctx.answerCbQuery();
});

bot.action('next_to_text', async (ctx) => {
  if (!ctx.session.selectedEffect || !ctx.session.selectedFrame) {
    return ctx.answerCbQuery('❌ Сначала выбери эффект и рамку');
  }
  
  await ctx.editMessageCaption('Добавить текст к стикеру?', textKeyboard);
  await ctx.answerCbQuery();
});

// Текст
bot.action('add_text', async (ctx) => {
  ctx.session.step = 'awaiting_text';
  await ctx.reply('✏️ *Введи текст для стикера:*\n\nМаксимум 30 символов', {
    parse_mode: 'Markdown'
  });
  await ctx.answerCbQuery();
});

bot.action('skip_text', async (ctx) => {
  ctx.session.textToAdd = null;
  await ctx.editMessageCaption(
    '✅ Текст не будет добавлен\n\nНажми "🚀 Создать!" для создания стикера',
    Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Создать стикер!', 'create_sticker')]
    ])
  );
  await ctx.answerCbQuery();
});

bot.action(/text_(top|center|bottom)/, async (ctx) => {
  const position = ctx.match[1];
  ctx.session.textPosition = position;
  await ctx.answerCbQuery(`✅ Позиция текста: ${position}`);
});

// Получение текста от пользователя
bot.on('text', async (ctx) => {
  if (ctx.session.step === 'awaiting_text') {
    const text = ctx.message.text;
    
    if (text.length > config.LIMITS.TEXT_LENGTH) {
      return ctx.reply(`❌ Слишком длинный текст! Максимум ${config.LIMITS.TEXT_LENGTH} символов`);
    }
    
    ctx.session.textToAdd = text;
    ctx.session.step = 'ready_to_create';
    
    // Показываем финальный предпросмотр
    try {
      const fileUrl = await stickerManager.getFileUrl(ctx.session.photoFileId);
      const imageBuffer = await require('../lib/image-processor').downloadImage(fileUrl);
      const imageProcessor = require('../lib/image-processor');
      
      const preview = await imageProcessor.createSticker(imageBuffer, {
        effect: ctx.session.selectedEffect,
        frame: ctx.session.selectedFrame,
        text: text,
        textPosition: ctx.session.textPosition
      });
      
      await ctx.replyWithPhoto(
        { source: preview },
        {
          caption: `✅ *Финальный предпросмотр*\n\n` +
                   `✨ Эффект: ${ctx.session.selectedEffect}\n` +
                   `🖼️ Рамка: ${ctx.session.selectedFrame}\n` +
                   `📝 Текст: "${text}"\n\n` +
                   `Нажми кнопку для создания:`,
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Создать стикер!', 'create_sticker')]
          ]).reply_markup
        }
      );
    } catch (error) {
      console.error('Error showing final preview:', error);
      ctx.reply('❌ Ошибка при создании предпросмотра', mainKeyboard);
    }
  }
});

// Создание стикера
bot.action('create_sticker', async (ctx) => {
  if (!ctx.session.photoFileId) {
    return ctx.answerCbQuery('❌ Нет фото для обработки');
  }
  
  ctx.session.processing = true;
  
  await ctx.editMessageCaption('🎨 *Создаю стикер...*\n\nЭто займет несколько секунд ⏳', {
    parse_mode: 'Markdown'
  });
  
  try {
    const result = await stickerManager.processAndSaveSticker(
      ctx.from.id,
      ctx.session.photoFileId,
      {
        effect: ctx.session.selectedEffect,
        frame: ctx.session.selectedFrame,
        text: ctx.session.textToAdd,
        textPosition: ctx.session.textPosition
      }
    );
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Отправляем сообщение об успехе
    await ctx.reply(
      `✅ *Стикер успешно создан!*\n\n` +
      `✨ Эффект: ${ctx.session.selectedEffect}\n` +
      `🖼️ Рамка: ${ctx.session.selectedFrame}\n` +
      `${ctx.session.textToAdd ? `📝 Текст: "${ctx.session.textToAdd}"\n` : ''}` +
      `⭐ +${config.RATING.CREATE_STICKER} к рейтингу\n` +
      `⏱️ Обработано за ${result.processingTime}ms\n\n` +
      `_Оцени стикер других пользователей!_`,
      {
        parse_mode: 'Markdown',
        ...mainKeyboard
      }
    );
    
    // Сбрасываем сессию
    ctx.session.step = 'idle';
    ctx.session.photoFileId = null;
    ctx.session.selectedEffect = config.EFFECTS.NONE;
    ctx.session.selectedFrame = config.FRAMES.NONE;
    ctx.session.textToAdd = null;
    ctx.session.textPosition = config.TEXT_POSITIONS.BOTTOM;
    ctx.session.processing = false;
    
  } catch (error) {
    console.error('Error creating sticker:', error);
    await ctx.reply(
      `❌ *Ошибка при создании стикера*\n\n` +
      `Причина: ${error.message || 'Неизвестная ошибка'}\n\n` +
      `Попробуй:\n` +
      `• Другое фото\n` +
      `• Уменьшить размер фото\n` +
      `• Более простые эффекты`,
      {
        parse_mode: 'Markdown',
        ...mainKeyboard
      }
    );
    
    ctx.session.step = 'idle';
    ctx.session.processing = false;
  }
});

// Голосование за стикеры
bot.action(/vote_(like|dislike)_(.+)/, async (ctx) => {
  const voteType = ctx.match[1];
  const stickerFileId = ctx.match[2];
  
  const result = await stickerManager.addVoteToSticker(
    ctx.from.id,
    stickerFileId,
    voteType
  );
  
  if (!result.success) {
    return ctx.answerCbQuery(result.error);
  }
  
  await ctx.answerCbQuery(`✅ Твой ${voteType === 'like' ? '👍' : '👎'} учтен!`);
  
  // Обновляем клавиатуру с новыми счетчиками
  await ctx.editMessageReplyMarkup(
    voteKeyboard(stickerFileId, result.sticker.likes).reply_markup
  );
});

// Новая кнопка
bot.action('new_sticker', (ctx) => {
  ctx.session.step = 'awaiting_photo';
  ctx.reply('📸 Отправь фото для нового стикера:', mainKeyboard);
  ctx.answerCbQuery();
});

// Статистика стикера
bot.action(/stats_(.+)/, async (ctx) => {
  const stickerFileId = ctx.match[1];
  const stickerInfo = await stickerManager.getStickerInfo(stickerFileId);
  
  if (!stickerInfo) {
    return ctx.answerCbQuery('❌ Стикер не найден');
  }
  
  const message = `
📊 *Статистика стикера*

🎨 ID: ${stickerInfo.id}
✨ Эффект: ${stickerInfo.effect}
🖼️ Рамка: ${stickerInfo.frame}
📝 Текст: ${stickerInfo.hasText ? '✅' : '❌'}
${stickerInfo.text ? `   "${stickerInfo.text}"\n` : ''}

👍 Лайков: ${stickerInfo.likes}
👀 Просмотров: ${stickerInfo.views}
📈 Вовлеченность: ${Math.round(stickerInfo.engagement)}%

👤 Автор: ${stickerInfo.author.username || stickerInfo.author.firstName}
⭐ Рейтинг автора: ${stickerInfo.author.rating}

📅 Создан: ${new Date(stickerInfo.created).toLocaleDateString('ru-RU')}
  `;
  
  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// ========== АДМИН КОМАНДЫ ==========
const ADMIN_IDS = process.env.ADMIN_IDS 
  ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim()))
  : [];

if (ADMIN_IDS.length > 0 && process.env.ENABLE_ADMIN_COMMANDS === 'true') {
  bot.command('admin', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) {
      return ctx.reply('❌ Доступ запрещен');
    }
    
    const stats = await db.getBotStats();
    
    const message = `
👑 *Панель администратора*

👥 Пользователей: ${stats.total_users}
🎨 Стикеров: ${stats.total_stickers}
👍 Голосов: ${stats.total_votes}
🔥 Активных сегодня: ${stats.daily_active_users}
⭐ Всего лайков: ${stats.total_likes}

📊 *Кэш:*
${Object.entries(cache.getStats()).map(([key, value]) => `  ${key}: ${value}`).join('\n')}

⚙️ *Система:*
  Память: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
  Uptime: ${Math.floor(process.uptime() / 60)} мин.
  `;
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['📊 Статистика', '🔄 Очистить кэш'],
        ['📢 Рассылка', '🔙 Назад']
      ]).resize()
    });
  });
  
  bot.hears('📊 Статистика', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    
    const stats = await db.getBotStats();
    await ctx.reply(
      `📈 Статистика бота:\n\n` +
      `Пользователи: ${stats.total_users}\n` +
      `Стикеры: ${stats.total_stickers}\n` +
      `Активные: ${stats.daily_active_users}`,
      mainKeyboard
    );
  });
}

// ========== ОБРАБОТКА ОШИБОК ==========
bot.catch((err, ctx) => {
  console.error(`❌ Error for ${ctx.updateType}:`, err);
  
  try {
    ctx.reply(
      '❌ Произошла ошибка. Пожалуйста, попробуй еще раз.\n\n' +
      'Если ошибка повторяется, сообщи администратору.',
      mainKeyboard
    );
  } catch (e) {
    console.error('Failed to send error message:', e);
  }
});

// ========== ЗАПУСК БОТА ==========
async function startBot() {
  try {
    // Инициализация базы данных
    await db.init();
    console.log('✅ Database connected');
    
    // Для Vercel
    if (process.env.VERCEL) {
      module.exports = async (req, res) => {
        try {
          if (req.method === 'POST') {
            await bot.handleUpdate(req.body, res);
          } else {
            res.status(200).json({
              status: 'ok',
              service: 'Telegram Sticker Bot',
              version: '2.0.0',
              timestamp: new Date().toISOString(),
              stats: await db.getBotStats()
            });
          }
        } catch (error) {
          console.error('Webhook error:', error);
          res.status(200).end();
        }
      };
      
      console.log('🤖 Bot ready for Vercel serverless');
    } else {
      // Локальный запуск
      bot.launch();
      console.log('🤖 Bot started in polling mode');
      
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));
    }
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Запускаем бота
startBot();
