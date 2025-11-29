// 📞  lib/telegramAPI.js – полностью готовый (Vercel + Neon)
const axios         = require('axios');
const FormData      = require('form-data');
const {
  downloadImage,
  createSticker
}                   = require('./imageProcessor');
const {
  saveUser,
  saveSticker,
  getUserStats,
  getTopUsers,
  createCollection,
  deleteCollection,
  addStickerToCollection,
  addToFavorites,
  getUserCollections,
  getUserFavorites,
  getAvailableEffects
}                   = require('./database');
const MenuBuilder   = require('./menuBuilder');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_URL   = `https://api.telegram.org/bot${BOT_TOKEN}`;

const userEffects       = new Map();
const awaitCollectionName = new Map();

/* ---------------  ГЛАВНЫЙ ВХОД  --------------- */
async function processMessage(update) {
  try {
    if (update.callback_query) return handleCallbackQuery(update.callback_query);
    if (!update.message) return;

    const msg    = update.message;
    const chatId = msg.chat.id;
    const text   = msg.text || '';

    await saveUser(chatId, msg.from?.username, msg.from?.first_name);

    if (awaitCollectionName.get(chatId) && text) {
      await handleCollectionCreation(chatId, text);
      awaitCollectionName.delete(chatId);
      return;
    }

    if (text === '/start') return sendWelcomeMessage(chatId);
    if (text.startsWith('/') || isMenuCommand(text)) return handleTextMessage(chatId, text);
    if (msg.photo) return handlePhoto(chatId, msg.photo);
    if (msg.document?.mime_type?.startsWith('image/')) return handleDocument(chatId, msg.document);

    handleTextMessage(chatId, text);
  } catch (e) {
    console.error('❌  processMessage:', e);
    sendMessage(msg?.chat?.id || update.callback_query?.message?.chat?.id, '❌ Произошла ошибка.');
  }
}

/* ---------------  ТЕКСТ / МЕНЮ  --------------- */
async function handleTextMessage(chatId, text) {
  const t = text.trim().toLowerCase();

  switch (t) {
    case '/start':
    case '🚀 начать создавать стикеры!':
      return sendWelcomeMessage(chatId);

    case '/help':
    case 'ℹ️ помощь':
      return sendHelpMessage(chatId);

    case '/stats':
    case '📊 статистика':
      return showUserStats(chatId);

    case '/top':
    case '🏆 топ':
      return showTopUsers(chatId);

    case '🎨 создать стикер':
      return sendMessage(chatId, '📷 Отправьте изображение:', MenuBuilder.removeMenu());

    case '⭐ избранное':
      return showUserFavorites(chatId);

    case '📚 мои подборки':
      return showCollectionsMenu(chatId);

    case '➕ новая подборка':
    case '📁 создать первую подборку':
      awaitCollectionName.set(chatId, true);
      return sendMessage(chatId, '📁 Введите название подборки:', MenuBuilder.removeMenu());

    case '🎭 эффекты':
      return showEffectsMenu(chatId);

    case '🔙 назад':
      userEffects.delete(chatId);
      awaitCollectionName.delete(chatId);
      return sendMainMenu(chatId);

    default: {
      const effects = await getAvailableEffects();
      if (effects.find(e => e.name.toLowerCase() === t)) return handleEffectSelection(chatId, t);
      return sendMainMenu(chatId);
    }
  }
}

/* ---------------  ФОТО / ДОКУМЕНТ  --------------- */
async function handlePhoto(chatId, photos) {
  const effect = userEffects.get(chatId) || 'none';
  await sendMessage(chatId, `🔄 Создаю стикер${effect !== 'none' ? ` с «${effect}»` : ''}...`);

  try {
    const url         = await getFileUrl(photos.pop().file_id);
    const imgBuf      = await downloadImage(url);
    const stickerBuf  = await createSticker(imgBuf, effect);
    const processingTime = Date.now() - Date.now(); // ✅ длительность

    await saveSticker(chatId, 'photo', stickerBuf.length, processingTime);
    await sendSticker(chatId, stickerBuf);
    userEffects.delete(chatId);

    const stickerId = Date.now().toString();
    await sendMessage(chatId, '✅ Стикер готов!', MenuBuilder.getStickerActions(stickerId));
  } catch (e) {
    console.error(e);
    await sendMessage(chatId, '❌ Не удалось создать стикер.');
  }
}

async function handleDocument(chatId, doc) {
  return handlePhoto(chatId, [{ file_id: doc.file_id }]);
}

/* ---------------  CALLBACK  --------------- */
async function handleCallbackQuery(q) {
  const chatId = q.message.chat.id;
  const data   = q.data;

  try {
    if (data.startsWith('fav_')) {
      const stickerId = data.split('_')[1];
      await addToFavorites(chatId, `sticker_${stickerId}`);
      return answerCallbackQuery(q.id, '⭐ В избранном!');
    }

    if (data.startsWith('col_')) {
      const stickerId  = data.split('_')[1];
      const collections = await getUserCollections(chatId);
      if (!collections.length)
        return sendMessage(chatId, '📁 Создайте подборку сначала.', MenuBuilder.getMainMenu());

      const keyboard = collections.map(c => [
        { text: `📂 ${c.name} (${c.stickers_count || 0})`,
          callback_data: `add_to_col_${c.id}_${stickerId}` }
      ]);
      return sendMessage(chatId, 'Выберите подборку:', { reply_markup: { inline_keyboard: keyboard } });
    }

    if (data.startsWith('add_to_col_')) {
      const [, , , collectionId, stickerId] = data.split('_');
      await addStickerToCollection(+collectionId, `sticker_${stickerId}`);
      return answerCallbackQuery(q.id, '✅ Добавлено!');
    }

    if (data.startsWith('delete_col_')) {
      const [, , collectionId] = data.split('_');
      await deleteCollection(chatId, +collectionId);
      await answerCallbackQuery(q.id, '🗑️ Подборка удалена!');
      return showCollectionsMenu(chatId);
    }

    if (data.startsWith('effect_')) {
      const effect = data.split('_')[1];
      userEffects.set(chatId, effect);
      await answerCallbackQuery(q.id, `🎭 ${effect}`);
      return sendMessage(chatId, 'Отправьте изображение:', MenuBuilder.removeMenu());
    }
  } catch (e) {
    console.error(e);
    await answerCallbackQuery(q.id, '❌ Ошибка');
  }
}

/* ---------------  ПОДБОРКИ / ЭФФЕКТЫ  --------------- */
async function handleCollectionCreation(chatId, name) {
  if (name.length < 3) return sendMessage(chatId, '❌ Минимум 3 символа.', MenuBuilder.getMainMenu());
  const effects = await getAvailableEffects();
  if (effects.find(e => e.name.toLowerCase() === name.toLowerCase()))
    return sendMessage(chatId, '❌ Название совпадает с эффектом.', MenuBuilder.getMainMenu());

  await createCollection(chatId, name);
  await sendMessage(chatId, `✅ Подборка «${name}» создана!`, MenuBuilder.getMainMenu());
}

async function handleEffectSelection(chatId, effectName) {
  userEffects.set(chatId, effectName);
  await sendMessage(chatId, `🎭 Эффект «${effectName}» выбран.\nОтправьте изображение.`, MenuBuilder.removeMenu());
}

/* ---------------  ИНФО-СООБЩЕНИЯ  --------------- */
async function sendWelcomeMessage(chatId) {
  await sendMessage(
    chatId,
    '👋 *Добро пожаловать в Sticker Bot!* 🎨\n\n' +
    'Я помогу быстро сделать стикеры из фото и картинок.\n\n' +
    '🌟 Что умею:\n• Обрезка до 512×512\n• Эффекты: винтаж, сепия, пикселизация…\n' +
    '⭐ Избранное и подборки\n\n' +
    '🚀 Нажмите «🎨 Создать стикер» и отправьте изображение!',
    MenuBuilder.getMainMenu()
  );
}

async function sendHelpMessage(chatId) {
  await sendMessage(
    chatId,
    '📖 *Как пользоваться*\n\n' +
    '1. Отправьте изображение (фото или файл)\n' +
    '2. Выберите эффект или оставьте без него\n' +
    '3. Готово! Стикер можно сохранить в избранное или подборку\n\n' +
    'Команды: /stats /top /help',
    MenuBuilder.getMainMenu()
  );
}

async function showUserStats(chatId) {
  const s = await getUserStats(chatId);
  await sendMessage(
    chatId,
    `📊 Ваша статистика:\nВсего: ${s.total}\nСегодня: ${s.today}\nПодборок: ${s.collections}\nИзбранных: ${s.favorites}`,
    MenuBuilder.getMainMenu()
  );
}

/* ----------  добавлены ПРОПУЩЕННЫЕ функции ---------- */
async function showTopUsers(chatId) {
  const top = await getTopUsers(5);
  let txt = '🏆 Топ-5:\n';
  top.forEach((u, i) => txt += `${i + 1}. ${u.first_name} – ${u.stickers_created}\n`);
  await sendMessage(chatId, txt, MenuBuilder.getMainMenu());
}

async function showCollectionsMenu(chatId) {
  const list = await getUserCollections(chatId);
  if (!list.length) return sendMessage(chatId, '📁 Подборок пока нет.', MenuBuilder.getMainMenu());

  let txt = '📚 Ваши подборки:\n';
  list.forEach(c => txt += `📂 ${c.name} – ${c.stickers_count || 0} шт.\n`);
  const keyboard = list.map(c => [
    { text: `🗑️ ${c.name}`, callback_data: `delete_col_${c.id}` }
  ]);
  await sendMessage(chatId, txt, { reply_markup: { inline_keyboard: keyboard } });
}

async function showUserFavorites(chatId) {
  const favs = await getUserFavorites(chatId);
  await sendMessage(chatId, `⭐ Избранных: ${favs.length}.`, MenuBuilder.getMainMenu());
}

async function showEffectsMenu(chatId) {
  const fx = await getAvailableEffects();
  let txt = '🎭 Выберите эффект:\n';
  fx.forEach(e => txt += `• ${e.name} – ${e.description}\n`);
  await sendMessage(chatId, txt, MenuBuilder.getEffectsMenu(fx));
}

async function sendMainMenu(chatId) {
  await sendMessage(chatId, 'Выберите действие:', MenuBuilder.getMainMenu());
}

/* ---------------  УТИЛИТЫ  --------------- */
function isMenuCommand(txt) {
  const cmds = ['🎨 создать стикер','⭐ избранное','📚 мои подборки','🎭 эффекты',
                '📊 статистика','🏆 топ','ℹ️ помощь','🔙 назад','🚀 начать создавать стикеры!'];
  return cmds.includes(txt.toLowerCase());
}

async function answerCallbackQuery(id, text = '') {
  await axios.post(`${BOT_URL}/answerCallbackQuery`, {
    callback_query_id: id,
    text,
    show_alert: !!text
  });
}

async function sendMessage(chatId, text, options = {}) {
  await axios.post(`${BOT_URL}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...options
  });
}

async function sendSticker(chatId, buffer) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('sticker', buffer, { filename: 'sticker.png', contentType: 'image/png' });
  await axios.post(`${BOT_URL}/sendSticker`, form, { headers: form.getHeaders() });
}

async function getFileUrl(fileId) {
  const { data } = await axios.get(`${BOT_URL}/getFile?file_id=${fileId}`);
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

module.exports = { processMessage };
