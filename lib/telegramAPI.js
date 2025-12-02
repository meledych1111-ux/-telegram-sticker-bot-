// 📞 ОБРАБОТКА СООБЩЕНИЙ ОТ TELEGRAM API С ИСПРАВЛЕНИЯМИ
// Убрали axios, используем встроенный fetch
const { downloadImage, createSticker } = require('./imageProcessor');
const { 
  saveUser, 
  saveSticker, 
  getUserStats, 
  getTopUsers,
  createCollection,
  addToFavorites,
  getUserCollections,
  getUserFavorites,
  getAvailableEffects
} = require('./database');
const MenuBuilder = require('./menuBuilder');

// Токен бота из переменных окружения Vercel
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// 📨 Обработка входящего сообщения от Telegram API
async function processMessage(update) {
  // Обработка callback query (inline кнопки)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  if (!update.message) return;

  const message = update.message;
  const chatId = message.chat.id;
  const username = message.from?.username;
  const firstName = message.from?.first_name;
  const text = message.text || '';

  try {
    // Проверяем что токен установлен
    if (!TELEGRAM_BOT_TOKEN) {
      await sendMessage(chatId, '❌ Бот не настроен. Проверьте переменные окружения.');
      return;
    }

    // 💾 СОХРАНЯЕМ ПОЛЬЗОВАТЕЛЯ В БАЗУ
    await saveUser(chatId, username, firstName);

    // 🆕 ОБРАБОТКА КОМАНДЫ /start
    if (text === '/start') {
      await sendWelcomeMessage(chatId);
      return;
    }

    // 🎯 ОБРАБОТКА КОМАНД МЕНЮ
    if (text.startsWith('/') || isMenuCommand(text)) {
      await handleTextMessage(chatId, text);
      return;
    }

    // Обработка изображений
    if (message.photo) {
      await handlePhoto(chatId, message.photo);
      return;
    }

    // Обработка документов
    if (message.document) {
      await handleDocument(chatId, message.document);
      return;
    }

    // Текстовые сообщения (не команды)
    if (text) {
      await handleTextMessage(chatId, text);
      return;
    }

  } catch (error) {
    console.error('❌ Ошибка обработки сообщения:', error);
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте еще раз.');
  }
}

// 🎯 ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ
async function handleTextMessage(chatId, text) {
  console.log(`📝 Обрабатываю команду: ${text}`);
  
  const command = text.startsWith('/') ? text.substring(1) : text;

  switch (command.toLowerCase()) {
    case 'start':
    case '🚀 начать создавать стикеры!':
      await sendMainMenu(chatId);
      break;
      
    case 'help':
    case 'помощь':
    case 'ℹ️ помощь':
      await sendHelpMessage(chatId);
      break;
      
    case 'stats':
    case 'статистика':
    case '📊 статистика':
      await showUserStats(chatId);
      break;
      
    case 'top':
    case 'топ':
    case '🏆 топ':
      await showTopUsers(chatId);
      break;

    // 🎨 СОЗДАНИЕ СТИКЕРОВ
    case '🎨 создать стикер':
      await sendMessage(chatId, 
        '📷 Отправьте мне изображение для создания стикера!\n\n' +
        '✅ Поддерживаются: фото, PNG, JPG, JPEG\n' +
        '📏 Автоматическая обрезка до 512x512',
        MenuBuilder.removeMenu()
      );
      break;

    // ⭐ ИЗБРАННОЕ
    case '⭐ избранное':
      await showFavoritesMenu(chatId);
      break;

    case '👀 просмотреть избранное':
      await showUserFavorites(chatId);
      break;

    // 📚 ПОДБОРКИ
    case '📚 мои подборки':
      await showCollectionsMenu(chatId);
      break;

    case '➕ новая подборка':
    case '📁 создать первую подборку':
      await createNewCollection(chatId);
      break;

    // 🎭 ЭФФЕКТЫ
    case '🎭 эффекты':
      await showEffectsMenu(chatId);
      break;

    case '🔙 назад':
      await sendMainMenu(chatId);
      break;

    default:
      // Проверяем если это название эффекта
      const effects = await getAvailableEffects(chatId);
      const effect = effects.find(e => 
        e.name.toLowerCase() === command.toLowerCase()
      );
      
      if (effect) {
        await handleEffectSelection(chatId, effect.name);
      } else {
        await sendMainMenu(chatId);
      }
  }
}

// 🔘 ОБРАБОТКА CALLBACK QUERY
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  try {
    if (data.startsWith('fav_')) {
      const stickerId = data.split('_')[1];
      await addToFavorites(chatId, `sticker_${stickerId}`);
      await answerCallbackQuery(callbackQuery.id, '⭐ Добавлено в избранное!');
    }
    else if (data.startsWith('col_')) {
      await sendMessage(chatId, '📁 Выберите подборку или создайте новую:', MenuBuilder.getCollectionsMenu([]));
      await answerCallbackQuery(callbackQuery.id);
    }
    else if (data.startsWith('eff_')) {
      await showEffectsMenu(chatId);
      await answerCallbackQuery(callbackQuery.id);
    }
    else if (data.startsWith('remake_')) {
      await sendMessage(chatId, '🔄 Отправьте новое изображение для пересоздания стикера');
      await answerCallbackQuery(callbackQuery.id);
    }

  } catch (error) {
    console.error('❌ Ошибка обработки callback:', error);
    await answerCallbackQuery(callbackQuery.id, '❌ Ошибка');
  }
}

// 🆕 ФУНКЦИИ ДЛЯ МЕНЮ

// 🏠 ОТПРАВИТЬ ГЛАВНОЕ МЕНЮ
async function sendMainMenu(chatId) {
  await sendMessage(chatId, 
    '🎨 *Добро пожаловать в Sticker Bot!*\n\n' +
    'Выберите действие из меню ниже:', 
    MenuBuilder.getMainMenu()
  );
}

// 👋 ПРИВЕТСТВЕННОЕ СООБЩЕНИЕ
async function sendWelcomeMessage(chatId) {
  const message = 
    '👋 *Добро пожаловать в Sticker Bot!* 🎨\n\n' +
    'Я помогу вам создавать крутые стикеры из ваших изображений!\n\n' +
    '🌟 *Что я умею:*\n' +
    '• Создавать стикеры из изображений\n' + 
    '• Применять крутые эффекты\n' +
    '• Сохранять в избранное и подборки\n' +
    '• Показывать статистику и рейтинги\n\n' +
    '🎯 *Нажмите кнопку ниже чтобы начать!*';

  await sendMessage(chatId, message, MenuBuilder.getStartMenu());
}

// ⭐ ПОКАЗАТЬ МЕНЮ ИЗБРАННОГО
async function showFavoritesMenu(chatId) {
  await sendMessage(chatId, 
    '⭐ *Ваше избранное*\n\n' +
    'Здесь хранятся ваши любимые стикеры:', 
    MenuBuilder.getFavoritesMenu()
  );
}

// 📚 ПОКАЗАТЬ МЕНЮ ПОДБОРОК
async function showCollectionsMenu(chatId) {
  const collections = await getUserCollections(chatId);
  await sendMessage(chatId, 
    '📚 *Ваши подборки*\n\n' +
    'Создавайте тематические коллекции стикеров:', 
    MenuBuilder.getCollectionsMenu(collections)
  );
}

// 🎭 ПОКАЗАТЬ МЕНЮ ЭФФЕКТОВ
async function showEffectsMenu(chatId) {
  const effects = await getAvailableEffects(chatId);
  
  await sendMessage(chatId, 
    '🎭 *Эффекты для стикеров*\n\n' +
    'Выберите эффект для следующего стикера:\n' +
    effects.map(e => `• ${e.name}${e.is_premium ? ' 💎' : ''} - ${e.description}`).join('\n'), 
    MenuBuilder.getEffectsMenu(effects)
  );
}

// 👀 ПОКАЗАТЬ ИЗБРАННЫЕ СТИКЕРЫ
async function showUserFavorites(chatId) {
  const favorites = await getUserFavorites(chatId);
  
  if (favorites.length === 0) {
    await sendMessage(chatId, 
      '⭐ *Ваше избранное пусто*\n\n' +
      'Добавляйте стикеры в избранное с помощью кнопки "⭐" после создания стикера.',
      MenuBuilder.getFavoritesMenu()
    );
  } else {
    await sendMessage(chatId, 
      `⭐ *Ваши избранные стикеры* (${favorites.length}):\n\n` +
      'Используйте кнопки ниже для управления избранным:',
      MenuBuilder.getFavoritesMenu()
    );
  }
}

// ➕ СОЗДАТЬ НОВУЮ ПОДБОРКУ
async function createNewCollection(chatId) {
  await sendMessage(chatId, 
    '📁 *Создание новой подборки*\n\n' +
    'Введите название для новой подборки:\n\n' +
    'Пример: "Мемы", "Природа", "Портреты"',
    MenuBuilder.removeMenu()
  );
}

// 🎯 ОБРАБОТКА ВЫБОРА ЭФФЕКТА
async function handleEffectSelection(chatId, effectName) {
  await sendMessage(chatId, 
    `🎭 *Эффект "${effectName}" выбран!*\n\n` +
    'Теперь отправьте мне изображение, и я применю этот эффект к стикеру.',
    MenuBuilder.removeMenu()
  );
}

// 📊 ПОКАЗАТЬ СТАТИСТИКУ ПОЛЬЗОВАТЕЛЯ
async function showUserStats(chatId) {
  try {
    const stats = await getUserStats(chatId);
    await sendMessage(chatId, 
      `📊 *Ваша статистика*\n\n` +
      `🎨 Создано стикеров: ${stats.total_stickers}\n` +
      `📅 Сегодня: ${stats.today_stickers}\n` +
      `📚 Подборки: ${stats.collections_count}\n` +
      `⭐ Избранное: ${stats.favorites_count}\n\n` +
      `Продолжайте в том же духе! 🚀`,
      MenuBuilder.getMainMenu()
    );
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    await sendMessage(chatId, '📊 Статистика временно недоступна');
  }
}

// 🏆 ПОКАЗАТЬ ТОП ПОЛЬЗОВАТЕЛЕЙ
async function showTopUsers(chatId) {
  try {
    const topUsers = await getTopUsers(5);
    let message = '🏆 *Топ создателей стикеров*\n\n';
    
    if (topUsers.length === 0) {
      message += 'Пока никто не создал стикеров 😢\nБудьте первым!';
    } else {
      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔸';
        const name = user.username ? `@${user.username}` : user.first_name || 'Аноним';
        message += `${medal} ${name} - ${user.stickers_created} стикеров\n`;
      });
    }
    
    await sendMessage(chatId, message, MenuBuilder.getMainMenu());
  } catch (error) {
    console.error('❌ Ошибка получения топа:', error);
    await sendMessage(chatId, '🏆 Рейтинг временно недоступен');
  }
}

// 🖼️ ОБРАБОТКА ФОТОГРАФИЙ
async function handlePhoto(chatId, photos) {
  const startTime = Date.now();
  
  await sendMessage(chatId, '🔄 Создаю стикер...');

  try {
    const photo = photos[photos.length - 1];
    const fileUrl = await getFileUrl(photo.file_id);
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer);
    
    const processingTime = Date.now() - startTime;
    await saveSticker(chatId, 'photo', stickerBuffer.length, processingTime);
    
    await sendSticker(chatId, stickerBuffer);
    await sendMessage(chatId, 
      '✅ Стикер готов!\n\nЧто дальше?',
      MenuBuilder.getStickerActions(Date.now())
    );

  } catch (error) {
    console.error('❌ Ошибка обработки фото:', error);
    await sendMessage(chatId, '❌ Не удалось создать стикер. Попробуйте другой файл.');
  }
}

// 📎 ОБРАБОТКА ДОКУМЕНТОВ
async function handleDocument(chatId, document) {
  const startTime = Date.now();
  const mimeType = document.mime_type;

  if (!mimeType || !mimeType.startsWith('image/')) {
    await sendMessage(chatId, '❌ Пожалуйста, отправьте изображение (PNG, JPG, JPEG)');
    return;
  }

  await sendMessage(chatId, '🔄 Обрабатываю изображение...');

  try {
    const fileUrl = await getFileUrl(document.file_id);
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer);
    
    const processingTime = Date.now() - startTime;
    await saveSticker(chatId, 'document', stickerBuffer.length, processingTime);
    
    await sendSticker(chatId, stickerBuffer);
    await sendMessage(chatId, 
      '✅ Стикер готов!',
      MenuBuilder.getStickerActions(Date.now())
    );

  } catch (error) {
    console.error('❌ Ошибка обработки документа:', error);
    await sendMessage(chatId, '❌ Не удалось создать стикер. Попробуйте другое изображение.');
  }
}

// 📖 СООБЩЕНИЕ ПОМОЩИ
async function sendHelpMessage(chatId) {
  const message =
    '📖 *Помощь по использованию Sticker Bot*\n\n' +
    '🎨 *Создание стикеров:*\n' +
    '• Отправьте любое изображение\n' +
    '• Используйте эффекты для крутого вида\n' +
    '• Сохраняйте в избранное и подборки\n\n' +
    '📚 *Подборки:*\n' +
    '• Создавайте тематические коллекции\n' +
    '• Добавляйте стикеры в подборки\n\n' +
    '⭐ *Избранное:*\n' +
    '• Сохраняйте лучшие стикеры\n' +
    '• Быстрый доступ к любимым\n\n' +
    '🎭 *Эффекты:*\n' +
    '• Винтаж, черно-белый, сепия\n' +
    '• Пикселизация и размытие\n\n' +
    '*Начните с кнопки "🎨 Создать стикер"!*';

  await sendMessage(chatId, message, MenuBuilder.getMainMenu());
}

// 🛠️ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

// Проверка является ли текст командой меню
function isMenuCommand(text) {
  const menuCommands = [
    '🎨 создать стикер', '⭐ избранное', '📚 мои подборки', '🎭 эффекты',
    '📊 статистика', '🏆 топ', 'ℹ️ помощь', '👀 просмотреть избранное',
    '➕ новая подборка', '📁 создать первую подборку', '🔙 назад',
    '🚀 начать создавать стикеры!'
  ];
  return menuCommands.includes(text.toLowerCase());
}

// Ответ на callback query
async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    await fetch(`${BOT_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: !!text
      })
    });
  } catch (error) {
    console.error('❌ Ошибка ответа на callback:', error.message);
  }
}

// 📤 Отправка текстового сообщения
async function sendMessage(chatId, text, options = {}) {
  try {
    const response = await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        ...options
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка отправки сообщения:', errorText);
    }
  } catch (error) {
    console.error('❌ Ошибка сети:', error.message);
  }
}

// 🎨 Отправка стикера
async function sendSticker(chatId, stickerBuffer) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    
    form.append('chat_id', chatId);
    form.append('sticker', stickerBuffer, {
      filename: 'sticker.png',
      contentType: 'image/png'
    });

    await fetch(`${BOT_URL}/sendSticker`, {
      method: 'POST',
      headers: form.getHeaders(),
      body: form
    });

  } catch (error) {
    console.error('❌ Ошибка отправки стикера:', error.message);
    throw error;
  }
}

// 🔗 Получение URL файла
async function getFileUrl(fileId) {
  try {
    const response = await fetch(`${BOT_URL}/getFile?file_id=${fileId}`);
    const data = await response.json();
    const filePath = data.result.file_path;
    return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
  } catch (error) {
    console.error('❌ Ошибка получения файла:', error.message);
    throw error;
  }
}

module.exports = {
  processMessage,
  sendMessage,
  getFileUrl
};
