// lib/telegramAPI.js
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const { downloadImage, createSticker, saveLocalSticker } = require('./imageProcessor');
const db = require('./database');
const MenuBuilder = require('./menuBuilder');
const path = require('path');
const fs = require('fs/promises');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Optional S3
let s3;
const USE_S3 = !!process.env.S3_BUCKET;
if (USE_S3) {
  const AWS = require('aws-sdk');
  s3 = new AWS.S3({
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET,
    region: process.env.S3_REGION
  });
}

const userEffects = new Map();
const awaitCollectionName = new Map();

// escape markdown v2
function escapeMarkdownV2(text = '') {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function isMenuCommand(txt = '') {
  const clean = (txt || '').trim().toLowerCase();
  const cmds = [
    'создать стикер',
    'избранное',
    'мои подборки',
    'эффекты',
    'статистика',
    'топ',
    'помощь',
    'назад',
    'начать создавать стикеры'
  ];
  return cmds.some(c => clean.includes(c));
}

async function answerCallbackQuery(id, text = '') {
  try {
    await axios.post(`${BOT_URL}/answerCallbackQuery`, {
      callback_query_id: id,
      text,
      show_alert: !!text
    });
  } catch (e) {
    console.error('answerCallbackQuery error', e?.response?.data || e.message);
  }
}

async function sendMessage(chatId, text, options = {}) {
  try {
    const body = {
      chat_id: chatId,
      text: escapeMarkdownV2(text),
      parse_mode: 'MarkdownV2',
      ...options
    };
    await axios.post(`${BOT_URL}/sendMessage`, body);
  } catch (e) {
    console.error('sendMessage error', e?.response?.data || e.message);
  }
}

async function sendSticker(chatId, buffer, filename = 'sticker.webp') {
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('sticker', buffer, { filename, contentType: 'image/webp' });

    await axios.post(`${BOT_URL}/sendSticker`, form, { headers: form.getHeaders() });
  } catch (e) {
    console.error('sendSticker error', e?.response?.data || e.message);
    await sendMessage(chatId, '❌ Ошибка отправки стикера.');
  }
}

async function uploadToS3(buffer, filename) {
  if (!USE_S3) return null;
  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: filename,
    Body: buffer,
    ContentType: 'image/webp',
    ACL: 'public-read'
  };
  const r = await s3.upload(params).promise();
  return r.Location;
}

async function getFileUrl(fileId) {
  try {
    const { data } = await axios.get(`${BOT_URL}/getFile?file_id=${fileId}`);
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
  } catch (e) {
    console.error('getFileUrl error', e?.response?.data || e.message);
    throw e;
  }
}

/* ---------------  MAIN ENTRY --------------- */
async function processMessage(update) {
  try {
    // callback_query
    if (update.callback_query) return handleCallbackQuery(update.callback_query);
    if (!update.message) return;

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';

    await db.saveUser(chatId, msg.from?.username, msg.from?.first_name);

    // collection name state
    if (awaitCollectionName.get(chatId) && text) {
      await handleCollectionCreation(chatId, text);
      awaitCollectionName.delete(chatId);
      return;
    }

    // commands & menu
    if (text === '/start') return sendWelcomeMessage(chatId);
    if (text.startsWith('/') || isMenuCommand(text)) return handleTextMessage(chatId, text);

    // photo / document image
    if (msg.photo) return handlePhoto(chatId, msg.photo);
    if (msg.document?.mime_type?.startsWith('image/')) return handleDocument(chatId, msg.document);

    // default
    return handleTextMessage(chatId, text);
  } catch (e) {
    console.error('processMessage error', e?.message || e);
  }
}

/* --------------- TEXT / MENU --------------- */
async function handleTextMessage(chatId, text) {
  const t = (text || '').trim().toLowerCase();

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
      const effects = await db.getAvailableEffects();
      if (effects.find(e => e.name.toLowerCase() === t)) return handleEffectSelection(chatId, t);
      return sendMainMenu(chatId);
    }
  }
}

/* --------------- PHOTO / DOCUMENT --------------- */
async function handlePhoto(chatId, photos) {
  const effect = userEffects.get(chatId) || 'none';
  await sendMessage(chatId, `🔄 Создаю стикер${effect !== 'none' ? ` с «${effect}»` : ''}...`);

  try {
    const photo = Array.isArray(photos) ? photos.pop() : photos;
    const url = await getFileUrl(photo.file_id);
    const imgBuf = await downloadImage(url);

    const start = Date.now();
    const stickerBuf = await createSticker(imgBuf, effect);
    const processingTime = Date.now() - start;

    // convert to webp for Telegram compatibility
    const webp = await require('sharp')(stickerBuf).webp({ quality: 90 }).toBuffer();

    // save locally
    const id = crypto.randomUUID().slice(0, 8);
    const filename = `sticker_${id}.webp`;
    const localPath = await saveLocalSticker(webp, filename).catch(e => {
      console.warn('saveLocalSticker failed', e?.message || e);
      return null;
    });

    // optionally upload to S3
    let urlStored = null;
    try {
      urlStored = await uploadToS3(webp, filename);
    } catch (e) {
      console.warn('uploadToS3 failed', e?.message || e);
    }

    // save DB record (sticker_size in bytes)
    await db.saveSticker(chatId, 'webp', webp.length, processingTime, urlStored || localPath);

    // send sticker to user
    await sendSticker(chatId, webp, filename);

    // clear chosen effect
    userEffects.delete(chatId);

    // show actions
    await sendMessage(chatId, '✅ Стикер готов!', MenuBuilder.getStickerActions(id));
  } catch (e) {
    console.error('handlePhoto error', e?.response?.data || e.message || e);
    await sendMessage(chatId, '❌ Не удалось создать стикер.');
  }
}

async function handleDocument(chatId, doc) {
  return handlePhoto(chatId, [{ file_id: doc.file_id }]);
}

/* --------------- CALLBACK --------------- */
async function handleCallbackQuery(q) {
  const chatId = q.message.chat.id;
  const data = q.data;

  try {
    if (data.startsWith('f_')) {
      const stickerId = data.split('_')[1];
      await db.addToFavorites(chatId, `sticker_${stickerId}`);
      return answerCallbackQuery(q.id, '⭐ В избранном!');
    }

    if (data.startsWith('c_')) {
      const stickerId = data.split('_')[1];
      const collections = await db.getUserCollections(chatId);
      if (!collections.length) {
        return sendMessage(chatId, '📁 Создайте подборку сначала.', MenuBuilder.getMainMenu());
      }

      const keyboard = collections.map(c => [
        { text: `📂 ${c.name} (${c.stickers_count || 0})`, callback_data: `addcol_${c.id}_${stickerId}` }
      ]);
      return sendMessage(chatId, 'Выберите подборку:', { reply_markup: { inline_keyboard: keyboard } });
    }

    if (data.startsWith('addcol_')) {
      const parts = data.split('_');
      const collectionId = parts[1];
      const stickerId = parts[2];
      await db.addStickerToCollection(+collectionId, `sticker_${stickerId}`);
      return answerCallbackQuery(q.id, '✅ Добавлено!');
    }

    if (data.startsWith('deletecol_')) {
      const parts = data.split('_');
      const collectionId = parts[1];
      await db.deleteCollection(chatId, +collectionId);
      await answerCallbackQuery(q.id, '🗑️ Подборка удалена!');
      return showCollectionsMenu(chatId);
    }

    if (data.startsWith('effect_')) {
      const parts = data.split('_');
      const effect = parts[1];
      userEffects.set(chatId, effect);
      await answerCallbackQuery(q.id, `🎭 ${effect}`);
      return sendMessage(chatId, 'Отправьте изображение:', MenuBuilder.removeMenu());
    }
  } catch (e) {
    console.error('handleCallbackQuery error', e?.message || e);
    await answerCallbackQuery(q.id, '❌ Ошибка');
  }
}

/* --------------- COLLECTIONS / EFFECTS --------------- */
async function handleCollectionCreation(chatId, name) {
  if (!name || name.trim().length < 3) {
    awaitCollectionName.delete(chatId);
    return sendMessage(chatId, '❌ Минимум 3 символа.', MenuBuilder.getMainMenu());
  }
  const effects = await db.getAvailableEffects();
  if (effects.find(e => e.name.toLowerCase() === name.toLowerCase())) {
    awaitCollectionName.delete(chatId);
    return sendMessage(chatId, '❌ Название совпадает с эффектом.', MenuBuilder.getMainMenu());
  }

  await db.createCollection(chatId, name.trim());
  awaitCollectionName.delete(chatId);
  return sendMessage(chatId, `✅ Подборка «${name.trim()}» создана!`, MenuBuilder.getMainMenu());
}

async function handleEffectSelection(chatId, effectName) {
  userEffects.set(chatId, effectName);
  await sendMessage(chatId, `🎭 Эффект «${effectName}» выбран.\nОтправьте изображение.`, MenuBuilder.removeMenu());
}

/* --------------- INFO MESSAGES --------------- */
async function sendWelcomeMessage(chatId) {
  const text =
    '👋 *Добро пожаловать в Sticker Bot!* 🎨\n\n' +
    'Я помогу быстро сделать стикеры из фото и картинок.\n\n' +
    '🌟 Что умею:\n• Обрезка до 512×512\n• Эффекты: винтаж, сепия, пикселизация…\n' +
    '⭐ Избранное и подборки\n\n' +
    '🚀 Нажмите «🎨 Создать стикер» и отправьте изображение!';
  await sendMessage(chatId, text, MenuBuilder.getMainMenu());
}

async function sendHelpMessage(chatId) {
  const text =
    '📖 *Как пользоваться*\n\n' +
    '1. Отправьте изображение (фото или файл)\n' +
    '2. Выберите эффект или оставьте без него\n' +
    '3. Готово! Стикер можно сохранить в избранное или подборку\n\n' +
    'Команды: /stats /top /help';
  await sendMessage(chatId, text, MenuBuilder.getMainMenu());
}

async function showUserStats(chatId) {
  const s = await db.getUserStats(chatId);
  await sendMessage(chatId, `📊 Ваша статистика:\nВсего: ${s.total}\nСегодня: ${s.today}\nПодборок: ${s.collections}\nИзбранных: ${s.favorites}`, MenuBuilder.getMainMenu());
}

async function showTopUsers(chatId) {
  const top = await db.getTopUsers(10);
  let txt = '🏆 Топ-10:\n';
  top.forEach((u, i) => txt += `${i + 1}. ${u.first_name || u.username || '—'} – ${u.stickers_created}\n`);
  await sendMessage(chatId, txt, MenuBuilder.getMainMenu());
}

async function showCollectionsMenu(chatId) {
  const list = await db.getUserCollections(chatId);
  if (!list.length) return sendMessage(chatId, '📁 Подборок пока нет.', MenuBuilder.getMainMenu());

  let txt = '📚 Ваши подборки:\n';
  list.forEach(c => txt += `📂 ${c.name} – ${c.stickers_count || 0} шт.\n`);
  const keyboard = list.map(c => [
    { text: `🗑️ ${c.name}`, callback_data: `deletecol_${c.id}` }
  ]);
  await sendMessage(chatId, txt, { reply_markup: { inline_keyboard: keyboard } });
}

async function showUserFavorites(chatId) {
  const favs = await db.getUserFavorites(chatId);
  await sendMessage(chatId, `⭐ Избранных: ${favs.length}.`, MenuBuilder.getMainMenu());
}

async function showEffectsMenu(chatId) {
  const fx = await db.getAvailableEffects();
  let txt = '🎭 Выберите эффект:\n';
  fx.forEach(e => txt += `• ${e.name} – ${e.description}\n`);
  await sendMessage(chatId, txt, MenuBuilder.getEffectsMenu(fx));
}

async function sendMainMenu(chatId) {
  await sendMessage(chatId, 'Выберите действие:', MenuBuilder.getMainMenu());
}

module.exports = { processMessage };
