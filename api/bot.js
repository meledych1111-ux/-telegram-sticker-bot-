require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('../lib/db');
const imageProcessor = require('../lib/image');
const FormData = require('form-data');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/bot`
  : process.env.WEBHOOK_URL;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN is required!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Простая сессия в памяти
const userStates = new Map();

function getUserState(userId) {
  if (!userStates.has(userId)) {
    userStates.set(userId, {
      step: null,
      imageUrl: null,
      effect: 'none',
      frame: 'none',
      text: null
    });
  }
  return userStates.get(userId);
}

// Главное меню
const mainMenu = Markup.keyboard([
  ['🎨 Создать стикер', '⭐ Мой профиль'],
  ['🏆 Топ недели', '🔥 Тренды'],
  ['❓ Помощь', '🎲 Случайный']
]).resize();

// Меню эффектов
const effectsMenu = Markup.inlineKeyboard([
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
    Markup.button.callback('🔄 Инверсия', 'effect_invert')
  ],
  [
    Markup.button.callback('🌀 Пиксели', 'effect_pixelate'),
    Markup.button.callback('📜 Винтаж', 'effect_vintage')
  ],
  [Markup.button.callback('➡️ Далее', 'next_frames')]
]);

// Меню рамок
const framesMenu = Markup.inlineKeyboard([
  [
    Markup.button.callback('🔵 Круг', 'frame_circle'),
    Markup.button.callback('💝 Сердце', 'frame_heart')
  ],
  [
    Markup.button.callback('⭐ Звезда', 'frame_star'),
    Markup.button.callback('🔲 Скругл.', 'frame_rounded')
  ],
  [Markup.button.callback('➡️ Далее', 'next_text')]
]);

// Меню текста
const textMenu = Markup.inlineKeyboard([
  [Markup.button.callback('📝 Добавить текст', 'add_text')],
  [Markup.button.callback('🚀 Создать стикер!', 'create_sticker')]
]);

// Команда /start
bot.start(async (ctx) => {
  await db.createUser(ctx.from);
  const user = await db.getUser(ctx.from.id);
  
  await ctx.replyWithPhoto(
    'https://i.imgur.com/3JQ3W5C.png', // Заглушка
    {
      caption: `🎉 Добро пожаловать в *Sticker Bot*!\n\n` +
               `✨ *Твой рейтинг:* ${user?.rating || 100}\n` +
               `🎨 *Создано стикеров:* ${user?.stickers_created || 0}\n\n` +
               `Выбирай действие:`,
      parse_mode: 'Markdown',
      ...mainMenu
    }
  );
});

// Создание стикера
bot.hears('🎨 Создать стикер', (ctx) => {
  const state = getUserState(ctx.from.id);
  state.step = 'waiting_photo';
  
  ctx.reply(
    '📸 *Отправь мне фото или картинку*\n\n' +
    'Формат: JPG, PNG, WebP\n' +
    'Размер: до 10 MB\n\n' +
    '_Совет: квадратные фото лучше подходят для стикеров_',
    { parse_mode: 'Markdown' }
  );
});

// Обработка фото
bot.on('photo', async (ctx) => {
  const state = getUserState(ctx.from.id);
  
  if (state.step !== 'waiting_photo') {
    return;
  }
  
  try {
    const photo = ctx.message.photo.pop();
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    
    state.imageUrl = fileUrl;
    state.step = 'choosing_effect';
    
    // Быстрый предпросмотр
    await ctx.replyWithPhoto(
      { url: fileUrl },
      {
        caption: '✅ Фото получено! Выбери эффект:',
        ...effectsMenu
      }
    );
  } catch (error) {
    console.error('Photo error:', error);
    ctx.reply('❌ Ошибка при обработке фото', mainMenu);
    state.step = null;
  }
});

// Выбор эффектов
bot.action(/effect_(.+)/, async (ctx) => {
  const state = getUserState(ctx.from.id);
  const effect = ctx.match[1];
  
  state.effect = effect;
  
  try {
    // Быстрая обработка для предпросмотра
    const imageBuffer = await imageProcessor.downloadImage(state.imageUrl);
    const preview = await imageProcessor.createPreview(imageBuffer, effect);
    
    await ctx.editMessageMedia({
      type: 'photo',
      media: { source: preview },
      caption: `✨ Эффект: *${effect}*\nВыбери рамку:`,
      parse_mode: 'Markdown'
    }, framesMenu);
    
    await ctx.answerCbQuery(`✅ Эффект: ${effect}`);
  } catch (error) {
    console.error('Effect error:', error);
    ctx.answerCbQuery('❌ Ошибка');
  }
});

// Выбор рамок
bot.action(/frame_(.+)/, async (ctx) => {
  const state = getUserState(ctx.from.id);
  const frame = ctx.match[1];
  
  state.frame = frame;
  
  try {
    const imageBuffer = await imageProcessor.downloadImage(state.imageUrl);
    const processed = await imageProcessor.createSticker(imageBuffer, {
      effect: state.effect,
      frame: frame
    });
    
    await ctx.editMessageMedia({
      type: 'photo',
      media: { source: processed },
      caption: `🖼️ Рамка: *${frame}*\nДобавить текст?`,
      parse_mode: 'Markdown'
    }, textMenu);
    
    await ctx.answerCbQuery(`✅ Рамка: ${frame}`);
  } catch (error) {
    console.error('Frame error:', error);
    ctx.answerCbQuery('❌ Ошибка');
  }
});

// Кнопки навигации
bot.action('next_frames', async (ctx) => {
  await ctx.editMessageCaption('Выбери рамку:', framesMenu);
  await ctx.answerCbQuery();
});

bot.action('next_text', async (ctx) => {
  await ctx.editMessageCaption('Добавить текст?', textMenu);
  await ctx.answerCbQuery();
});

// Добавление текста
bot.action('add_text', async (ctx) => {
  await ctx.reply('✏️ *Введи текст для стикера:*\n\nМакс. 30 символов', {
    parse_mode: 'Markdown'
  });
  await ctx.answerCbQuery();
  
  const state = getUserState(ctx.from.id);
  state.step = 'waiting_text';
});

// Получение текста
bot.on('text', async (ctx) => {
  const state = getUserState(ctx.from.id);
  
  if (state.step === 'waiting_text' && ctx.message.text.length <= 30) {
    state.text = ctx.message.text;
    state.step = 'ready';
    
    // Показываем финальный превью
    try {
      const imageBuffer = await imageProcessor.downloadImage(state.imageUrl);
      const processed = await imageProcessor.createSticker(imageBuffer, {
        effect: state.effect,
        frame: state.frame,
        text: state.text
      });
      
      await ctx.replyWithPhoto(
        { source: processed },
        {
          caption: `📝 Текст: "${state.text}"\n\nНажми кнопку для создания стикера:`,
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Создать стикер!', 'create_sticker')]
          ])
        }
      );
    } catch (error) {
      console.error('Text preview error:', error);
      ctx.reply('❌ Ошибка', mainMenu);
    }
  }
});

// Создание стикера (основная логика)
bot.action('create_sticker', async (ctx) => {
  const state = getUserState(ctx.from.id);
  
  if (!state.imageUrl) {
    return ctx.answerCbQuery('❌ Нет фото');
  }
  
  await ctx.editMessageCaption('🎨 *Создаю стикер...*', {
    parse_mode: 'Markdown'
  });
  
  try {
    // Скачиваем и обрабатываем
    const imageBuffer = await imageProcessor.downloadImage(state.imageUrl);
    const stickerBuffer = await imageProcessor.createSticker(imageBuffer, {
      effect: state.effect,
      frame: state.frame,
      text: state.text
    });
    
    // Отправляем как фото (быстрее чем стикер в Vercel)
    const msg = await ctx.replyWithPhoto(
      { source: stickerBuffer },
      {
        caption: `✅ *Стикер готов!*\n\n` +
                 `✨ Эффект: ${state.effect}\n` +
                 `🖼️ Рамка: ${state.frame}\n` +
                 `${state.text ? `📝 Текст: "${state.text}"\n` : ''}\n` +
                 `_Используй кнопки ниже:_`,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('👍', 'like_sticker'),
            Markup.button.callback('👎', 'dislike_sticker')
          ],
          [Markup.button.callback('🎨 Новый стикер', 'new_sticker')]
        ])
      }
    );
    
    // Сохраняем в базу
    await db.saveSticker({
      userId: ctx.from.id,
      fileId: msg.photo[msg.photo.length - 1].file_id,
      fileUniqueId: `user_${ctx.from.id}_${Date.now()}`,
      effect: state.effect,
      frame: state.frame,
      text: state.text
    });
    
    // Обновляем рейтинг
    await db.updateRating(ctx.from.id, 10);
    
    // Сбрасываем состояние
    state.step = null;
    state.imageUrl = null;
    
    await ctx.answerCbQuery('✅ Стикер создан! +10 к рейтингу');
    
  } catch (error) {
    console.error('Sticker creation error:', error);
    await ctx.answerCbQuery('❌ Ошибка при создании');
    await ctx.reply('Не удалось создать стикер. Попробуй другое фото.', mainMenu);
  }
});

// Голосование
bot.action(['like_sticker', 'dislike_sticker'], async (ctx) => {
  const voteType = ctx.callbackQuery.data.split('_')[0];
  const message = ctx.callbackQuery.message;
  
  if (message.photo && message.photo.length > 0) {
    const fileId = message.photo[message.photo.length - 1].file_id;
    const sticker = await db.getSticker(fileId);
    
    if (sticker) {
      const success = await db.addVote(ctx.from.id, sticker.id, voteType);
      
      if (success) {
        await ctx.answerCbQuery(`✅ Твой ${voteType === 'like' ? '👍' : '👎'} учтен!`);
        
        // Обновляем кнопки
        const updatedSticker = await db.getSticker(fileId);
        await ctx.editMessageReplyMarkup({
          inline_keyboard: [
            [
              Markup.button.callback(`👍 ${updatedSticker.likes}`, 'like_sticker'),
              Markup.button.callback(`👎 ${updatedSticker.dislikes || 0}`, 'dislike_sticker')
            ],
            [Markup.button.callback('🎨 Новый стикер', 'new_sticker')]
          ]
        });
      } else {
        await ctx.answerCbQuery('❌ Уже голосовал');
      }
    }
  }
});

// Профиль
bot.hears('⭐ Мой профиль', async (ctx) => {
  const stats = await db.getUserStats(ctx.from.id);
  const user = await db.getUser(ctx.from.id);
  
  const message = `
🏆 *Твой профиль*

👤 *Имя:* ${user.first_name} ${user.last_name || ''}
⭐ *Рейтинг:* ${user.rating}
🎨 *Стикеров:* ${stats.stickers_created}
👍 *Лайков:* ${stats.total_likes}
📈 *Средний рейтинг:* ${Math.round(stats.avg_likes * 10) / 10}

*Уровень:* ${Math.floor(user.rating / 100)} ⭐
*До след. уровня:* ${100 - (user.rating % 100)} очков

#${Math.floor(Math.random() * 100) + 1} в общем рейтинге
  `;
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainMenu
  });
});

// Топ недели
bot.hears('🏆 Топ недели', async (ctx) => {
  const topStickers = await db.getTopStickers(10);
  
  let message = '🏆 *Топ стикеров недели*\n\n';
  
  topStickers.forEach((sticker, index) => {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    message += `${medals[index]} @${sticker.username || sticker.first_name}\n`;
    message += `   👍 ${sticker.likes} • ${sticker.rating_percent.toFixed(1)}%\n`;
    message += `   ✨ ${sticker.effect || 'нет'}\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainMenu
  });
});

// Тренды
bot.hears('🔥 Тренды', async (ctx) => {
  const trends = await db.getTrendingStickers();
  
  let message = '🔥 *Тренды сейчас*\n\n';
  
  trends.forEach((sticker, index) => {
    const fire = ['🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥', '🔥'];
    message += `${fire[index]} ${sticker.effect || 'Без эффекта'}\n`;
    message += `   👤 @${sticker.username || 'anon'}\n`;
    message += `   📈 ${(sticker.trend_score * 100).toFixed(1)}%\n\n`;
  });
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...mainMenu
  });
});

// Случайный стикер
bot.hears('🎲 Случайный', async (ctx) => {
  const stickers = await db.getTopStickers(50);
  const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
  
  if (randomSticker) {
    await ctx.replyWithPhoto(randomSticker.file_id, {
      caption: `🎲 *Случайный стикер*\n\n` +
               `👤 Автор: @${randomSticker.username || 'anon'}\n` +
               `✨ Эффект: ${randomSticker.effect || 'нет'}\n` +
               `👍 Лайков: ${randomSticker.likes}\n\n` +
               `_Нажми /start для меню_`,
      parse_mode: 'Markdown'
    });
  } else {
    await ctx.reply('😢 Пока нет стикеров. Создай первый!', mainMenu);
  }
});

// Помощь
bot.hears('❓ Помощь', (ctx) => {
  ctx.reply(
    `📚 *Помощь по боту*\n\n` +
    `*🎨 Создание стикера:*\n` +
    `1. Нажми "🎨 Создать стикер"\n` +
    `2. Отправь фото\n` +
    `3. Выбери эффект\n` +
    `4. Выбери рамку\n` +
    `5. Добавь текст (опционально)\n` +
    `6. Получи стикер!\n\n` +
    `*🏆 Рейтинговая система:*\n` +
    `• Создание стикера: +10 очков\n` +
    `• Лайк твоему стикеру: +5 очков\n` +
    `• Каждые 100 очков = новый уровень\n\n` +
    `*📊 Статистика:*\n` +
    `• Топ пользователей\n` +
    `• Топ стикеров\n` +
    `• Тренды\n\n` +
    `_Бот оптимизирован для Vercel + Neon_`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

// Новая кнопка
bot.action('new_sticker', (ctx) => {
  ctx.reply('Выбери действие:', mainMenu);
  ctx.answerCbQuery();
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error:`, err);
  ctx.reply('❌ Произошла ошибка. Попробуй еще раз.', mainMenu);
});

// Инициализация БД
db.initDB().then(() => {
  console.log('✅ Bot initialized');
});

// Экспорт для Vercel
module.exports = async (req, res) => {
  try {
    // Для вебхука от Telegram
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
    } else {
      // Для проверки работоспособности
      res.status(200).json({
        status: 'ok',
        message: 'Sticker Bot is running on Vercel + Neon',
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).end();
  }
};

// Если запуск локально
if (require.main === module) {
  bot.launch();
  console.log('🤖 Bot started in polling mode');
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
