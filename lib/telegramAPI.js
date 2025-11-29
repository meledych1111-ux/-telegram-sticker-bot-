// 📞  lib/telegramAPI.js  –  просмотр избранных и подборок + отправка стикеров
const axios = require('axios');
const FormData = require('form-data');
const { downloadImage, createSticker } = require('./imageProcessor');
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
  getUserStickersByCollection, // ← новая функция
  removeFromFavorites,
  removeFromCollection
} = require('./database');
const MenuBuilder = require('./menuBuilder');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

const userEffects = new Map();
const awaitCollectionName = new Map();

/* ==========  ГЛАВНЫЙ ВХОД  ========== */
async function processMessage(update) {
  try {
    if (update.callback_query) return handleCallbackQuery(update.callback_query);
    if (!update.message) return;

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';

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

/* ==========  ТЕКСТ / КОМАНДЫ  ========== */
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
      return showFavoritesMenu(chatId);

    case '👀 просмотреть избранное':
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
      const fx = await getAvailableEffects();
      if (fx.find(e => e.name.toLowerCase() === t)) return handleEffectSelection(chatId, t);
      return sendMainMenu(chatId);
    }
  }
}

/* ==========  ФОТО / ДОКУМЕНТ  ========== */
async function handlePhoto(chatId, photos) {
  const effect = userEffects.get(chatId) || 'none';
  await sendMessage(chatId, `🔄 Создаю стикер${effect !== 'none' ? ` с «${effect}»` : ''}...`);

  try {
    const url = await getFileUrl(photos.pop().file_id);
    const imgBuf = await downloadImage(url);
    const sticker = await createSticker(imgBuf, effect);
    const time = Date.now();

    await saveSticker(chatId, 'photo', sticker.length, time - start);
    const fileId = await sendStickerReturnId(chatId, sticker); // ← получаем file_id

    userEffects.delete(chatId);

    await sendMessage(chatId, '✅ Стикер готов!', MenuBuilder.getStickerActions(fileId));
  } catch (e) {
    console.error(e);
    await sendMessage(chatId, '❌ Не удалось создать стикер.');
  }
}

async function handleDocument(chatId, doc) {
  return handlePhoto(chatId, [{ file_id: doc.file_id }]);
}

/* ==========  ОТПРАВКА СТИКЕРА + ПОЛУЧЕНИЕ file_id  ========== */
async function sendStickerReturnId(chatId, buffer) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('sticker', buffer, { filename: 'st.png', contentType: 'image/png' });

  const { data } = await axios.post(`${BOT_URL}/sendSticker`, form, { headers: form.getHeaders() });
  return data.result.sticker.file_id; // ← Telegram-идентификатор стикера
}

/* ==========  CALLBACK QUERY  ========== */
async function handleCallbackQuery(q) {
  const chatId = q.message.chat.id;
  const data = q.data;

  try {
    /* ➕ Добавить в избранное */
    if (data.startsWith('fav_add_')) {
      const fileId = data.split('_')[2];
      await addToFavorites(chatId, fileId);
      return answerCallbackQuery(q.id, '⭐ В избранном!');
    }

    /* ➖ Убрать из избранного */
    if (data.startsWith('fav_del_')) {
      const fileId = data.split('_')[2];
      await removeFromFavorites(chatId, fileId);
      await answerCallbackQuery(q.id, '❌ Удалено из избранного');
      return showUserFavorites(chatId); // обновим список
    }

    /* 📁 Добавить в подборку */
    if (data.startsWith('col_add_')) {
      const fileId = data.split('_')[2];
      const collections = await getUserCollections(chatId);
      if (!collections.length) return sendMessage(chatId, '📁 Создайте подборку сначала.', MenuBuilder.getMainMenu());

      const keyboard = collections.map(c => [
        { text: `📂 ${c.name} (${c.stickers_count || 0})`,
          callback_data: `add_to_col_${c.id}_${fileId}` }
      ]);
      return sendMessage(chatId, 'Выберите подборку:', { reply_markup: { inline_keyboard: keyboard } });
    }

    /* ✅ Подтверждение добавления в подборку */
    if (data.startsWith('add_to_col_')) {
      const [, , , collectionId, fileId] = data.split('_');
      await addStickerToCollection(+collectionId, fileId);
      return answerCallbackQuery(q.id, '✅ Добавлено в подборку!');
    }

    /* 📂 Просмотреть подборку (отправить стикеры) */
    if (data.startsWith('view_col_')) {
      const collectionId = +data.split('_')[2];
      const stickers = await getUserStickersByCollection(chatId, collectionId);
      if (!stickers.length) return answerCallbackQuery(q.id, '📂 Подборка пуста');

      // Отправляем стикеры по одному (Telegram не умеет галерею)
      for (const s of stickers) {
        await sendStickerById(chatId, s.sticker_data);
      }
      return answerCallbackQuery(q.id, `📂 Отправлено ${stickers.length} стикер(ов)`);
    }

    /* 🗑️ Удалить подборку */
    if (data.startsWith('delete_col_')) {
      const collectionId = +data.split('_')[2];
      await deleteCollection(chatId, collectionId);
      await answerCallbackQuery(q.id, '🗑️ Подборка удалена!');
      return showCollectionsMenu(chatId);
    }

    /* 🎭 Выбор эффекта */
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

/* ==========  ПРОСМОТР ИЗБРАННОГО / ПОДБОРОК  ========== */
async function showUserFavorites(chatId) {
  const favs = await getUserFavorites(chatId);
  if (!favs.length) return sendMessage(chatId, '⭐ Избранное пусто.', MenuBuilder.getMainMenu());

  const keyboard = favs.map(f => [
    { text: `🖼️ Стикер`, callback_data: `send_sticker_${f.sticker_data}` },
    { text: `❌`, callback_data: `fav_del_${f.sticker_data}` }
  ]);

  await sendMessage(chatId, `⭐ Ваши избранные стикеры (${favs.length}):`, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function showCollectionsMenu(chatId) {
  const collections = await getUserCollections(chatId);
  if (!collections.length) return sendMessage(chatId, '📁 Подборок пока нет.', MenuBuilder.getMainMenu());

  const keyboard = collections.map(c => [
    { text: `📂 ${c.name} (${c.stickers_count || 0})`, callback_data: `view_col_${c.id}` },
    { text: `🗑️`, callback_data: `delete_col_${c.id}` }
  ]);

  await sendMessage(chatId, '📚 Ваши подборки:', { reply_markup: { inline_keyboard: keyboard } });
}

/* ==========  ОТПРАВКА СТИКЕРА ПО file_id  ========== */
async function sendStickerById(chatId, fileId) {
  await axios.post(`${BOT_URL}/sendSticker`, { chat_id: chatId, sticker: fileId });
}

/* ==========  ОСТАЛЬНОЕ (без изменений)  ========== */
async function handleCollectionCreation(chatId, name) {
  if (name.length < 3) return sendMessage(chatId, '❌ Минимум 3 символа.', MenuBuilder.getMainMenu());
  const fx = await getAvailableEffects();
  if (fx.find(e => e.name.toLowerCase() === name.toLowerCase()))
    return sendMessage(chatId, '❌ Название совпадает с эффектом.', MenuBuilder.getMainMenu());

  await createCollection(chatId, name);
  await sendMessage(chatId, `✅ Подборка «${name}» создана!`, MenuBuilder.getMainMenu());
}

async function handleEffectSelection(chatId, effectName) {
  userEffects.set(chatId, effectName);
  await sendMessage(chatId, `🎭 Эффект «${effectName}» выбран.\nОтправьте изображение.`, MenuBuilder.removeMenu());
}

async function sendWelcomeMessage(chatId) {
  await sendMessage(chatId, '👋 *Добро пожаловать в Sticker Bot!*\nЯ помогу сделать стикеры из фото.\n\n🎨 Нажмите «Создать стикер» и отправьте изображение!', MenuBuilder.getMainMenu());
}

async function sendHelpMessage(chatId) {
  await sendMessage(chatId, '📖 *Помощь*\nОтправьте изображение → выберите эффект → получите стикер!\nКоманды: /stats /top /help', MenuBuilder.getMainMenu());
}

async function showUserStats(chatId) {
  const s = await getUserStats(chatId);
  await sendMessage(chatId, `📊 Статистика:\nВсего: ${s.total}\nСегодня: ${s.today}\nПодборок: ${s.collections}\nИзбранных: ${s.favorites}`, MenuBuilder.getMainMenu());
}

async function showTopUsers(chatId) {
  const top = await getTopUsers(5);
  let txt = '🏆 Топ-5:\n';
  top.forEach((u, i) => txt += `${i + 1}. ${u.first_name} – ${u.stickers_created}\n`);
  await sendMessage(chatId, txt, MenuBuilder.getMainMenu());
}

async function sendMainMenu(chatId) {
  await sendMessage(chatId, 'Выберите действие:', MenuBuilder.getMainMenu());
}

/* ==========  УТИЛИТЫ  ========== */
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

async function getFileUrl(fileId) {
  const { data } = await axios.get(`${BOT_URL}/getFile?file_id=${fileId}`);
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

module.exports = { processMessage };
