// 📞 ПОЛНЫЙ ИСПРАВЛЕННЫЙ ФАЙЛ telegramAPI.js
const axios = require('axios');
const { downloadImage, createSticker } = require('./imageProcessor');
const { 
  saveUser, 
  saveSticker, 
  getUserStats, 
  getTopUsers,
  createCollection,
  addStickerToCollection,
  addToFavorites,
  getUserCollections,
  getUserFavorites,
  getAvailableEffects
} = require('./database');
const MenuBuilder = require('./menuBuilder');

// Токен бота из переменных окружения Vercel
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Переменная для хранения выбранного эффекта
const userEffects = new Map();

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
    if (!BOT_TOKEN) {
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
  console.log(`📝 Обрабатываю текст: "${text}"`);
  
  const cleanText = text.trim().toLowerCase();

  switch (cleanText) {
    case '/start':
    case 'start':
    case '🚀 начать создавать стикеры!':
      await sendWelcomeMessage(chatId);
      break;
      
    case '/help':
    case 'help':
    case 'помощь':
    case 'ℹ️ помощь':
      await sendHelpMessage(chatId);
      break;
      
    case '/stats':
    case 'stats':
    case 'статистика':
    case '📊 статистика':
      await showUserStats(chatId);
      break;
      
    case '/top':
    case 'top':
    case 'топ':
    case '🏆 топ':
      await showTopUsers(chatId);
      break;

    case '🎨 создать стикер':
      await sendMessage(chatId, 
        '📷 Отправьте мне изображение для создания стикера!',
        MenuBuilder.removeMenu()
      );
      break;

    case '⭐ избранное':
      await showFavoritesMenu(chatId);
      break;

    case '👀 просмотреть избранное':
      await showUserFavorites(chatId);
      break;

    case '📚 мои подборки':
      await showCollectionsMenu(chatId);
      break;

    case '➕ новая подборка':
    case '📁 создать первую подборку':
      await createNewCollection(chatId);
      break;

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
        e.name.toLowerCase() === cleanText
      );
      
      if (effect) {
        await handleEffectSelection(chatId, effect.name);
      } else if (cleanText.length > 2 && cleanText.length < 50) {
        // Если это не эффект, возможно создание подборки
        await handleCollectionCreation(chatId, text);
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
      const stickerId = data.split('_')[1];
      const collections = await getUserCollections(chatId);
      
      if (collections.length === 0) {
        await sendMessage(chatId, 
          '📁 У вас пока нет подборок. Создайте первую!',
          MenuBuilder.getCollectionsMenu([])
        );
      } else {
        await sendMessage(chatId, 
          '📁 Выберите подборку для сохранения:',
          MenuBuilder.getCollectionsMenu(collections)
        );
      }
    }
    else if (data.startsWith('add_to_col_')) {
      const parts = data.split('_');
      const collectionId = parts[3];
      const stickerId = parts[4];
      
      await addStickerToCollection(collectionId, `sticker_${stickerId}`);
      await answerCallbackQuery(callbackQuery.id, '✅ Добавлено в подборку!');
    }
    else if (data.startsWith('eff_')) {
      await showEffectsMenu(chatId);
    }
    else if (data.startsWith('effect_')) {
      const effectName = data.split('_')[1];
      userEffects.set(chatId, effectName);
      await answerCallbackQuery(callbackQuery.id, `🎭 Выбран эффект: ${effectName}`);
      await sendMessage(chatId, 
        `🎭 Эффект "${effectName}" выбран!\n\nОтправьте изображение для применения эффекта.`,
        MenuBuilder.removeMenu()
      );
    }
    else if (data.startsWith('remake_')) {
      await sendMessage(chatId, '🔄 Отправьте новое изображение для пересоздания стикера');
    }

  } catch (error) {
    console.error('❌ Ошибка обработки callback:', error);
    await answerCallbackQuery(callbackQuery.id, '❌ Ошибка');
  }
}

// 🆕 ОБРАБОТКА СОЗДАНИЯ ПОДБОРКИ
async function handleCollectionCreation(chatId, collectionName) {
  try {
    if (collectionName && collectionName.length > 2) {
      await createCollection(chatId, collectionName);
      await sendMessage(chatId, 
        `✅ Подборка "${collectionName}" создана!\n\n` +
        'Теперь вы можете добавлять в нее стикеры.',
        MenuBuilder.getMainMenu()
      );
    }
  } catch (error) {
    console.error('❌ Ошибка создания подборки:', error);
    await sendMessage(chatId, 
      '❌ Не удалось создать подборку. Возможно, такое название уже существует.',
      MenuBuilder.getMainMenu()
    );
  }
}

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
    '• Сохранять в избранное\n' +
    '• Создавать подборки\n' +
    '• Показывать статистику\n\n' +
    '🚀 *Начните с кнопки "🎨 Создать стикер"!*';

  await sendMessage(chatId, message, MenuBuilder.getMainMenu());
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
  try {
    const collections = await getUserCollections(chatId);
    await sendMessage(chatId, 
      '📚 *Ваши подборки*\n\n' +
      'Создавайте тематические коллекции стикеров:', 
      MenuBuilder.getCollectionsMenu(collections)
    );
  } catch (error) {
    console.error('❌ Ошибка получения подборок:', error);
    await sendMessage(chatId, 
      '📚 У вас пока нет подборок.\nСоздайте первую!',
      MenuBuilder.getCollectionsMenu([])
    );
  }
}

// 🎭 ПОКАЗАТЬ МЕНЮ ЭФФЕКТОВ
async function showEffectsMenu(chatId) {
  try {
    const effects = await getAvailableEffects(chatId);
    
    let message = '🎭 *Эффекты для стикеров*\n\n';
    message += 'Нажмите на эффект чтобы выбрать его:\n\n';
    
    effects.forEach(effect => {
      message += `• ${effect.name} - ${effect.description}\n`;
    });
    
    await sendMessage(chatId, message, MenuBuilder.getEffectsMenu(effects));
  } catch (error) {
    console.error('❌ Ошибка показа эффектов:', error);
    await sendMessage(chatId, 
      '🎭 Эффекты временно недоступны',
      MenuBuilder.getMainMenu()
    );
  }
}

// 👀 ПОКАЗАТЬ ИЗБРАННЫЕ СТИКЕРЫ
async function showUserFavorites(chatId) {
  try {
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
  } catch (error) {
    console.error('❌ Ошибка получения избранного:', error);
    await sendMessage(chatId, 
      '⭐ Не удалось загрузить избранное',
      MenuBuilder.getMainMenu()
    );
  }
}

// ➕ СОЗДАТЬ НОВУЮ ПОДБОРКУ
async function createNewCollection(chatId) {
  await sendMessage(chatId, 
    '📁 *Создание новой подборки*\n\n' +
    'Введите название для новой подборки:\n\n' +
    '✨ *Примеры:* "Мемы", "Природа", "Портреты"',
    MenuBuilder.removeMenu()
  );
}

// 🎯 ОБРАБОТКА ВЫБОРА ЭФФЕКТА
async function handleEffectSelection(chatId, effectName) {
  userEffects.set(chatId, effectName);
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
  
  // Получаем выбранный эффект
  const effect = userEffects.get(chatId) || 'none';
  
  await sendMessage(chatId, `🔄 Создаю стикер${effect !== 'none' ? ` с эффектом "${effect}"` : ''}...`);

  try {
    const photo = photos[photos.length - 1];
    const fileUrl = await getFileUrl(photo.file_id);
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer, effect); // ПЕРЕДАЕМ ЭФФЕКТ
    
    const processingTime = Date.now() - startTime;
    await saveSticker(chatId, 'photo', stickerBuffer.length, processingTime);
    
    // Отправляем стикер
    await sendSticker(chatId, stickerBuffer);
    
    // Сбрасываем эффект после применения
    userEffects.delete(chatId);
    
    // Отправляем сообщение с действиями
    await sendMessage(chatId, 
      `✅ *Стикер готов!*${effect !== 'none' ? `\n🎭 Эффект: ${effect}` : ''}\n\n` +
      'Что хотите сделать дальше?',
      MenuBuilder.getStickerActions(Date.now().toString())
    );

  } catch (error) {
    console.error('❌ Ошибка обработки фото:', error);
    await sendMessage(chatId, 
      '❌ Не удалось создать стикер.\nПопробуйте другой файл.'
    );
  }
}

// 📎 ОБРАБОТКА ДОКУМЕНТОВ
async function handleDocument(chatId, document) {
  const startTime = Date.now();
  const mimeType = document.mime_type;

  // Проверяем что это изображение
  if (!mimeType || !mimeType.startsWith('image/')) {
    await sendMessage(chatId, 
      '❌ Пожалуйста, отправьте изображение\n\n' +
      '✅ *Поддерживаемые форматы:* PNG, JPG, JPEG'
    );
    return;
  }

  // Получаем выбранный эффект
  const effect = userEffects.get(chatId) || 'none';
  
  await sendMessage(chatId, `🔄 Обрабатываю изображение${effect !== 'none' ? ` с эффектом "${effect}"` : ''}...`);

  try {
    const fileUrl = await getFileUrl(document.file_id);
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer, effect); // ПЕРЕДАЕМ ЭФФЕКТ
    
    const processingTime = Date.now() - startTime;
    await saveSticker(chatId, 'document', stickerBuffer.length, processingTime);
    
    // Отправляем стикер
    await sendSticker(chatId, stickerBuffer);
    
    // Сбрасываем эффект после применения
    userEffects.delete(chatId);
    
    // Отправляем сообщение с действиями
    await sendMessage(chatId, 
      `✅ *Стикер готов!*${effect !== 'none' ? `\n🎭 Эффект: ${effect}` : ''}`,
      MenuBuilder.getStickerActions(Date.now().toString())
    );

  } catch (error) {
    console.error('❌ Ошибка обработки документа:', error);
    await sendMessage(chatId, 
      '❌ Не удалось создать стикер.\nПопробуйте другое изображение.'
    );
  }
}

// 📖 СООБЩЕНИЕ ПОМОЩИ
async function sendHelpMessage(chatId) {
  const message =
    '📖 *Помощь по использованию Sticker Bot*\n\n' +
    '🎨 *Создание стикеров:*\n' +
    '• Отправьте любое изображение (фото или файл)\n' +
    '• Автоматическая обрезка до 512x512\n' +
    '• Оптимизация для Telegram\n\n' +
    '🎭 *Эффекты:*\n' +
    '• Винтаж - теплые тона\n' +
    '• Черно-белый - градации серого\n' +
    '• Сепия - старинный вид\n' +
    '• Пикселизация - блочный эффект\n' +
    '• Размытие - мягкий фокус\n\n' +
    '⭐ *Избранное:*\n' +
    '• Сохраняйте лучшие стикеры\n' +
    '• Быстрый доступ к любимым\n\n' +
    '📚 *Подборки:*\n' +
    '• Создавайте тематические коллекции\n' +
    '• Организуйте свои стикеры\n\n' +
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
    await axios.post(`${BOT_URL}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: !!text
    });
  } catch (error) {
    console.error('❌ Ошибка ответа на callback:', error);
  }
}

// 📤 Отправка текстового сообщения
async function sendMessage(chatId, text, options = {}) {
  try {
    const messageData = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      ...options
    };

    await axios.post(`${BOT_URL}/sendMessage`, messageData);
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.response?.data || error.message);
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

    await axios.post(`${BOT_URL}/sendSticker`, form, {
      headers: form.getHeaders()
    });

  } catch (error) {
    console.error('❌ Ошибка отправки стикера:', error.response?.data || error.message);
    throw error;
  }
}

// 🔗 Получение URL файла
async function getFileUrl(fileId) {
  try {
    const response = await axios.get(`${BOT_URL}/getFile?file_id=${fileId}`);
    const filePath = response.data.result.file_path;
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  } catch (error) {
    console.error('❌ Ошибка получения файла:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  processMessage
};
