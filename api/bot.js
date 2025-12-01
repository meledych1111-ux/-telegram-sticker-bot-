require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN required');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ========== ГЛОБАЛЬНЫЕ КОНСТАНТЫ (без файлов) ==========
const CONFIG = {
  EFFECTS: ['none', 'grayscale', 'sepia', 'invert', 'blur', 'neon', 'gradient'],
  FRAMES: ['none', 'circle', 'heart', 'star', 'rounded'],
  MAX_SIZE: 512,
  MAX_DURATION: 9000 // 9 секунд на обработку
};

// ========== ПРОСТАЯ БАЗА ДАННЫХ В ПАМЯТИ (для демо) ==========
const db = {
  users: new Map(),
  stickers: new Map(),
  votes: new Map(),
  
  async getUser(userId) {
    return this.users.get(userId) || { 
      id: userId, 
      rating: 100, 
      stickers: 0, 
      created: Date.now() 
    };
  },
  
  async saveUser(user) {
    const existing = await this.getUser(user.id);
    this.users.set(user.id, { ...existing, ...user });
    return this.users.get(user.id);
  },
  
  async saveSticker(data) {
    const sticker = {
      id: Date.now().toString(),
      ...data,
      likes: 0,
      created: Date.now()
    };
    this.stickers.set(sticker.id, sticker);
    
    // Обновляем пользователя
    const user = await this.getUser(data.userId);
    user.stickers = (user.stickers || 0) + 1;
    user.rating = (user.rating || 100) + 10;
    this.users.set(data.userId, user);
    
    return sticker;
  },
  
  async getSticker(id) {
    return this.stickers.get(id);
  },
  
  async addVote(userId, stickerId, type) {
    const key = `${userId}:${stickerId}`;
    const sticker = await this.getSticker(stickerId);
    
    if (sticker) {
      if (type === 'like') {
        sticker.likes = (sticker.likes || 0) + 1;
      }
      this.stickers.set(stickerId, sticker);
      this.votes.set(key, type);
    }
    
    return sticker;
  },
  
  async getTopStickers(limit = 10) {
    return Array.from(this.stickers.values())
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, limit);
  }
};

// ========== ОПТИМИЗИРОВАННЫЙ IMAGE PROCESSOR ==========
class FastImageProcessor {
  constructor() {
    this.sharp = require('sharp');
    this.axios = require('axios');
  }
  
  async createSticker(imageUrl, options = {}) {
    const start = Date.now();
    
    try {
      // 1. Скачиваем (таймаут 3 секунды)
      const response = await this.axios({
        url: imageUrl,
        responseType: 'arraybuffer',
        timeout: 3000,
        maxContentLength: 5 * 1024 * 1024 // 5MB
      });
      
      let image = this.sharp(response.data)
        .resize(CONFIG.MAX_SIZE, CONFIG.MAX_SIZE, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      
      // 2. Применяем эффект (максимум 2 секунды)
      if (options.effect && options.effect !== 'none') {
        image = this.applyEffect(image, options.effect);
      }
      
      // 3. Добавляем рамку (максимум 2 секунды)
      if (options.frame && options.frame !== 'none') {
        image = await this.addFrame(image, options.frame);
      }
      
      // 4. Возвращаем буфер
      const buffer = await image.png().toBuffer();
      
      console.log(`✅ Sticker created in ${Date.now() - start}ms, ${buffer.length} bytes`);
      return { success: true, buffer };
      
    } catch (error) {
      console.error('Image processing error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  applyEffect(image, effect) {
    switch(effect) {
      case 'grayscale': return image.grayscale();
      case 'sepia': return image.recomb([[0.393,0.769,0.189],[0.349,0.686,0.168],[0.272,0.534,0.131]]);
      case 'invert': return image.negate();
      case 'blur': return image.blur(2);
      case 'neon': return image.linear(1.2, -30);
      case 'gradient': return image;
      default: return image;
    }
  }
  
  async addFrame(image, frame) {
    const metadata = await image.metadata();
    
    if (frame === 'circle') {
      const mask = Buffer.from(`
        <svg width="${metadata.width}" height="${metadata.height}">
          <circle cx="${metadata.width/2}" cy="${metadata.height/2}" 
                  r="${Math.min(metadata.width, metadata.height)/2}" fill="white"/>
        </svg>
      `);
      return image.composite([{ input: mask, blend: 'dest-in' }]);
    }
    
    return image;
  }
}

const imageProcessor = new FastImageProcessor();

// ========== КЛАВИАТУРЫ ==========
const mainMenu = Markup.keyboard([
  ['🎨 Быстрый стикер'],
  ['⭐ Мой рейтинг', '🏆 Топ']
]).resize();

const effectsMenu = Markup.inlineKeyboard([
  [Markup.button.callback('⚫ Ч/Б', 'effect_grayscale')],
  [Markup.button.callback('🟤 Сепия', 'effect_sepia')],
  [Markup.button.callback('🌈 Неон', 'effect_neon')],
  [Markup.button.callback('🚀 Далее', 'next_frames')]
]);

const framesMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🔵 Круг', 'frame_circle')],
  [Markup.button.callback('💝 Сердце', 'frame_heart')],
  [Markup.button.callback('⭐ Звезда', 'frame_star')],
  [Markup.button.callback('✅ Создать', 'create_sticker')]
]);

// ========== КОМАНДЫ ==========
bot.start(async (ctx) => {
  await db.saveUser(ctx.from);
  
  await ctx.reply(
    `🎨 *Sticker Bot*\n\n` +
    `Создавай стикеры за 10 секунд!\n` +
    `Эффекты: Ч/Б, Сепия, Неон\n` +
    `Рамки: Круг, Сердце, Звезда\n\n` +
    `*Нажми кнопку ниже:*`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

bot.hears('🎨 Быстрый стикер', (ctx) => {
  ctx.reply(
    '📸 *Отправь квадратное фото*\n\nЛучший размер: 512x512\nФормат: JPG/PNG\n\n_Обработка займет 5-10 секунд_',
    { parse_mode: 'Markdown' }
  );
});

bot.on('photo', async (ctx) => {
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    
    // Сохраняем в сессии
    ctx.session = ctx.session || {};
    ctx.session.photoUrl = fileUrl;
    
    await ctx.replyWithPhoto(
      { url: fileUrl },
      {
        caption: '✅ Фото получено! Выбери эффект:',
        ...effectsMenu
      }
    );
    
  } catch (error) {
    console.error('Photo error:', error);
    ctx.reply('❌ Ошибка загрузки фото', mainMenu);
  }
});

// Эффекты
bot.action(/effect_(.+)/, async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.effect = ctx.match[1];
  
  await ctx.answerCbQuery(`✅ ${ctx.match[1]}`);
  await ctx.editMessageCaption('Выбери рамку:', framesMenu);
});

bot.action('next_frames', (ctx) => {
  ctx.editMessageCaption('Выбери рамку:', framesMenu);
});

// Рамки
bot.action(/frame_(.+)/, async (ctx) => {
  ctx.session = ctx.session || {};
  ctx.session.frame = ctx.match[1];
  
  await ctx.answerCbQuery(`✅ ${ctx.match[1]}`);
  
  // Сразу создаем стикер
  await createSticker(ctx);
});

// Создание стикера
async function createSticker(ctx) {
  const session = ctx.session || {};
  
  if (!session.photoUrl) {
    return ctx.answerCbQuery('❌ Нет фото');
  }
  
  await ctx.editMessageCaption('🎨 Создаю стикер... ⏳');
  
  const startTime = Date.now();
  
  try {
    // Создаем стикер
    const result = await imageProcessor.createSticker(session.photoUrl, {
      effect: session.effect || 'none',
      frame: session.frame || 'none'
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Проверяем время
    const elapsed = Date.now() - startTime;
    if (elapsed > CONFIG.MAX_DURATION) {
      throw new Error(`Timeout: ${elapsed}ms > ${CONFIG.MAX_DURATION}ms`);
    }
    
    // Отправляем как фото (быстрее чем стикер)
    const message = await ctx.replyWithPhoto(
      { source: result.buffer },
      {
        caption: `✅ Готово! (${elapsed}ms)\n✨ ${session.effect || 'нет'}\n🖼️ ${session.frame || 'нет'}`,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('👍', `like_${startTime}`)]
        ])
      }
    );
    
    // Сохраняем в "базу"
    await db.saveSticker({
      userId: ctx.from.id,
      fileId: message.photo[message.photo.length - 1].file_id,
      effect: session.effect,
      frame: session.frame
    });
    
    // Очищаем сессию
    ctx.session = {};
    
  } catch (error) {
    console.error('Sticker creation failed:', error);
    await ctx.reply(
      `❌ Ошибка: ${error.message || 'timeout'}\n\n` +
      `Попробуй:\n• Меньше фото\n• Без эффектов\n• Квадратное фото`,
      mainMenu
    );
    
    ctx.session = {};
  }
}

bot.action('create_sticker', async (ctx) => {
  await createSticker(ctx);
});

// Голосование
bot.action(/like_(.+)/, async (ctx) => {
  const stickerId = ctx.match[1];
  const sticker = await db.getSticker(stickerId);
  
  if (sticker) {
    await db.addVote(ctx.from.id, stickerId, 'like');
    await ctx.answerCbQuery('✅ Спасибо за лайк!');
    
    await ctx.editMessageCaption(
      `${sticker.caption || 'Стикер'}\n👍 ${sticker.likes + 1}`,
      Markup.inlineKeyboard([
        [Markup.button.callback(`👍 ${sticker.likes + 1}`, `like_${stickerId}`)]
      ])
    );
  }
});

// Профиль
bot.hears('⭐ Мой рейтинг', async (ctx) => {
  const user = await db.getUser(ctx.from.id);
  
  await ctx.reply(
    `🏆 *Твой профиль*\n\n` +
    `👤 ${ctx.from.first_name}\n` +
    `⭐ Рейтинг: ${user.rating}\n` +
    `🎨 Стикеров: ${user.stickers || 0}\n\n` +
    `_Создай больше стикеров!_`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

// Топ
bot.hears('🏆 Топ', async (ctx) => {
  const topStickers = await db.getTopStickers(5);
  
  if (topStickers.length === 0) {
    return ctx.reply('😢 Пока нет стикеров', mainMenu);
  }
  
  let message = '🏆 *Топ стикеров*\n\n';
  
  topStickers.forEach((sticker, i) => {
    message += `${['🥇','🥈','🥉','4️⃣','5️⃣'][i] || '🎨'} `;
    message += `👍 ${sticker.likes || 0}\n`;
  });
  
  await ctx.reply(message, { parse_mode: 'Markdown', ...mainMenu });
});

// ========== ОБРАБОТКА ДЛЯ VERCEL ==========
module.exports = async (req, res) => {
  // Начинаем обработку сразу
  res.setHeader('Content-Type', 'application/json');
  
  try {
    // Проверяем метод
    if (req.method === 'POST') {
      // Быстро обрабатываем update
      await bot.handleUpdate(req.body, res);
    } else {
      // Статус для GET запросов
      res.status(200).json({
        status: 'ok',
        bot: 'running',
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        uptime: Math.floor(process.uptime())
      });
    }
  } catch (error) {
    console.error('Handler error:', error);
    res.status(200).json({ error: 'handled' });
  }
};

// Локальный запуск
if (require.main === module) {
  bot.launch();
  console.log('Bot started locally');
}
