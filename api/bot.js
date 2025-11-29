import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { init, sql } from '../lib/database.js';
import { downloadImage, createSticker } from '../lib/imageProcessor.js';
import { saveSticker } from '../lib/fileStorage.js';
import { getMainMenu, getEffectsMenu } from './commands.js';

await init();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Для хранения выбора эффекта по пользователю
const userEffects = new Map();

bot.start(async ctx => {
  await ctx.reply('👋 Добро пожаловать в Sticker Bot!', getMainMenu());
});

// Команда для создания стикера
bot.hears('Создать стикер 🎨', async ctx => {
  await ctx.reply('Выберите эффект для нового стикера:', getEffectsMenu());
});

// Выбор эффекта через inline-кнопки
bot.on('callback_query', async ctx => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith('effect_')) return;
  const effect = data.replace('effect_', '');
  userEffects.set(ctx.from.id, effect);
  await ctx.answerCbQuery(`Выбран эффект: ${effect}`);
  await ctx.reply('Отправьте фотографию для создания стикера');
});

// Получение фото и создание стикера
bot.on('photo', async ctx => {
  try {
    const effect = userEffects.get(ctx.from.id) || 'none';

    const fileId = ctx.message.photo.pop().file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const buffer = await downloadImage(fileLink.href);

    const stickerBuffer = await createSticker(buffer, effect);
    const filename = `sticker_${Date.now()}.png`;
    const path = await saveSticker(stickerBuffer, filename);

    const [user] = await sql`SELECT id FROM users WHERE chat_id=${ctx.chat.id}`;
    await sql`INSERT INTO stickers(user_id,path,effect) VALUES(${user.id},${path},${effect})`;

    // Обновляем счетчик
    await sql`UPDATE users SET stickers_created=COALESCE(stickers_created,0)+1 WHERE id=${user.id}`;

    await ctx.replyWithSticker({ source: stickerBuffer });
  } catch(e) {
    console.error(e);
    await ctx.reply('❌ Ошибка при создании стикера');
  }
});

// Просмотр и удаление подборок
bot.hears('Мои подборки 📂', async ctx => {
  const collections = await sql`SELECT * FROM collections WHERE user_id=(SELECT id FROM users WHERE chat_id=${ctx.chat.id})`;
  if (!collections.length) return ctx.reply('📂 У вас нет подборок');
  let txt = '📂 Ваши подборки:\n';
  collections.forEach(c => txt += `${c.id}: ${c.name}\n`);
  txt += '\nОтправьте /delete_collection <id> для удаления';
  await ctx.reply(txt);
});

bot.command('delete_collection', async ctx => {
  const parts = ctx.message.text.split(' ');
  const id = parseInt(parts[1]);
  if (!id) return ctx.reply('❌ Укажите ID подборки');
  await sql`DELETE FROM collections WHERE id=${id} AND user_id=(SELECT id FROM users WHERE chat_id=${ctx.chat.id})`;
  await ctx.reply('✅ Подборка удалена');
});

bot.launch();
console.log('✅ Bot запущен на Vercel!');
