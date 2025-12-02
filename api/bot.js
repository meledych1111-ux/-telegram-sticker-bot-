// ⚡ ПОЛНОЦЕННЫЙ STICKER BOT
const MenuBuilder = require('../lib/menuBuilder');
const { downloadImage } = require('../lib/imageProcessor');
const stickerCreator = require('../lib/stickerCreator');
// 📦 Хранилище временных данных пользователей
const userSessions = {};
const userSessions = {};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Sticker Bot работает!',
      features: 'Стикеры, эффекты, избранное, подборки, рейтинг',
      commands: '/start, /help, /effects, /stats, /top'
    });
  }

  if (req.method === 'POST') {
    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не настроен');
      
      const update = req.body;
      const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

      // 🔘 ОБРАБОТКА CALLBACK QUERY
      if (update.callback_query) {
        const callback = update.callback_query;
        const chatId = callback.message.chat.id;
        const data = callback.data;

        // Отвечаем на callback
        await answerCallbackQuery(BOT_URL, callback.id, '✅');

        if (data.startsWith('fav_')) {
          await sendMessage(BOT_URL, chatId, '⭐ Добавлено в избранное!', MenuBuilder.removeMenu());
        }
        else if (data.startsWith('col_')) {
          await sendMessage(BOT_URL, chatId, 
            '📁 Выберите подборку или создайте новую:',
            MenuBuilder.getCollectionsMenu()
          );
        }
        else if (data.startsWith('eff_')) {
          await showEffectsMenu(BOT_URL, chatId);
        }

        return res.status(200).json({ ok: true });
      }

      // 📨 ОБРАБОТКА СООБЩЕНИЯ
      if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text || '';
        const username = message.from?.username || 'Пользователь';

        // 🆕 НАЧАЛО РАБОТЫ
        if (text === '/start') {
          await sendMessage(BOT_URL, chatId, 
            `👋 *Добро пожаловать, ${username}!* 🎨\n\n` +
            'Я помогу вам создавать крутые стикеры из ваших изображений!\n\n' +
            '✨ *Что я умею:*\n' +
            '• Создавать стикеры из фото\n' +
            '• Применять эффекты (винтаж, ЧБ, сепия)\n' +
            '• Сохранять в избранное и подборки\n' +
            '• Показывать статистику и рейтинг\n\n' +
            '🎯 *Начните с кнопки ниже!*',
            MenuBuilder.getStartMenu()
          );
        }
        // 🎯 ГЛАВНОЕ МЕНЮ
        else if (text === '🚀 Начать создавать стикеры!' || text === '🔙 Назад') {
          await sendMainMenu(BOT_URL, chatId);
        }
        // 🎨 СОЗДАТЬ СТИКЕР
        else if (text === '🎨 Создать стикер') {
          await sendMessage(BOT_URL, chatId,
            '📷 *Отправьте мне изображение!*\n\n' +
            '✅ *Поддерживаются:*\n' +
            '• Фотографии из Telegram\n' +
            '• PNG, JPG, JPEG файлы\n' +
            '• Размером до 20 МБ\n\n' +
            '📏 *Автоматически обрежется до 512x512*',
            MenuBuilder.removeMenu()
          );
        }
        // ⭐ ИЗБРАННОЕ
        else if (text === '⭐ Избранное') {
          await showFavoritesMenu(BOT_URL, chatId);
        }
        else if (text === '👀 Просмотреть избранное') {
          await sendMessage(BOT_URL, chatId,
            '⭐ *Ваше избранное*\n\n' +
            '_Здесь будут ваши любимые стикеры_\n\n' +
            '📌 *Как добавить:*\n' +
            'После создания стикера нажмите кнопку "⭐ В избранное"',
            MenuBuilder.getFavoritesMenu()
          );
        }
        // 📚 ПОДБОРКИ
        else if (text === '📚 Мои подборки') {
          await showCollectionsMenu(BOT_URL, chatId);
        }
        else if (text === '📁 Создать первую подборку' || text === '➕ Новая подборка') {
          await sendMessage(BOT_URL, chatId,
            '📁 *Создание новой подборки*\n\n' +
            'Введите название для подборки:\n\n' +
            '💡 *Примеры:*\n' +
            '• "Мемы"\n' +
            '• "Природа"\n' +
            '• "Портреты"\n' +
            '• "Путешествия"',
            MenuBuilder.removeMenu()
          );
          userSessions[chatId] = { waitingFor: 'collection_name' };
        }
        // 🎭 ЭФФЕКТЫ
        else if (text === '🎭 Эффекты') {
          await showEffectsMenu(BOT_URL, chatId);
        }
        // 📊 СТАТИСТИКА
        else if (text === '📊 Статистика') {
          await sendMessage(BOT_URL, chatId,
            `📊 *Статистика @${username}:*\n\n` +
            '🎨 Создано стикеров: *0*\n' +
            '⭐ Избранных: *0*\n' +
            '📚 Подборок: *0*\n' +
            '🏆 Место в рейтинге: *-*\n\n' +
            '_База данных скоро будет подключена_',
            MenuBuilder.getMainMenu()
          );
        }
        // 🏆 ТОП
        else if (text === '🏆 Топ') {
          await sendMessage(BOT_URL, chatId,
            '🏆 *Топ создателей стикеров:*\n\n' +
            '🥇 Пока никто не создал стикеров\n' +
            '🥈 Будь первым!\n' +
            '🥉 Отправь фото прямо сейчас!\n\n' +
            '🎯 *Создай свой первый стикер!*',
            MenuBuilder.getMainMenu()
          );
        }
        // ℹ️ ПОМОЩЬ
        else if (text === 'ℹ️ Помощь' || text === '/help') {
          await sendMessage(BOT_URL, chatId,
            '📖 *Помощь по Sticker Bot:*\n\n' +
            '🎨 *Создание стикеров:*\n' +
            '1. Нажми "🎨 Создать стикер"\n' +
            '2. Отправь фото или изображение\n' +
            '3. Выбери эффект (если хочешь)\n' +
            '4. Получи готовый стикер!\n\n' +
            '⭐ *Избранное:*\n' +
            'Сохраняй лучшие стикеры кнопкой "⭐"\n\n' +
            '📚 *Подборки:*\n' +
            'Создавай тематические коллекции\n\n' +
            '🎭 *Эффекты:*\n' +
            'Винтаж, ЧБ, сепия, пикселизация\n\n' +
            '💎 *Полная версия скоро!*',
            MenuBuilder.getMainMenu()
          );
        }
        // 📸 ОБРАБОТКА ФОТО
        else if (message.photo) {
          await handlePhoto(BOT_URL, chatId, message.photo, username);
        }
        // 📎 ОБРАБОТКА ДОКУМЕНТОВ
        else if (message.document && message.document.mime_type?.startsWith('image/')) {
          await handleDocument(BOT_URL, chatId, message.document, username);
        }
        // 🎭 ВЫБОР ЭФФЕКТА
        else if (['винтаж', 'черно-белый', 'сепия', 'пикселизация', 'размытие'].includes(text.toLowerCase())) {
          await handleEffectSelection(BOT_URL, chatId, text, username);
        }
        // 📝 НАЗВАНИЕ ПОДБОРКИ
        else if (userSessions[chatId]?.waitingFor === 'collection_name') {
          await sendMessage(BOT_URL, chatId,
            `✅ Подборка "${text}" создана!\n\n` +
            'Теперь вы можете добавлять в неё стикеры.\n' +
            'После создания стикера нажмите "📁 В подборку"',
            MenuBuilder.getCollectionsMenu([{ name: text, stickers_count: 0 }])
          );
          delete userSessions[chatId];
        }
        // 💬 ЛЮБОЙ ДРУГОЙ ТЕКСТ
        else if (text) {
          await sendMainMenu(BOT_URL, chatId);
        }
      }

      return res.status(200).json({ ok: true });

    } catch (error) {
      console.error('❌ Ошибка:', error);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(404).json({ error: 'Not Found' });
};

// 🏠 ГЛАВНОЕ МЕНЮ
async function sendMainMenu(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '🎨 *Sticker Bot*\n\n' +
    'Выберите действие из меню ниже:',
    MenuBuilder.getMainMenu()
  );
}

// 🎭 МЕНЮ ЭФФЕКТОВ
async function showEffectsMenu(BOT_URL, chatId) {
  const effects = [
    { name: 'Без эффекта', is_premium: false },
    { name: 'Винтаж', is_premium: false },
    { name: 'Черно-белый', is_premium: false },
    { name: 'Сепия', is_premium: false },
    { name: 'Пикселизация', is_premium: false },
    { name: 'Размытие', is_premium: true }
  ];
  
  await sendMessage(BOT_URL, chatId,
    '🎭 *Эффекты для стикеров*\n\n' +
    'Выберите эффект для следующего стикера:\n' +
    effects.map(e => `• ${e.name}${e.is_premium ? ' 💎' : ''}`).join('\n'),
    MenuBuilder.getEffectsMenu(effects)
  );
}

// ⭐ МЕНЮ ИЗБРАННОГО
async function showFavoritesMenu(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '⭐ *Ваше избранное*\n\n' +
    'Здесь хранятся ваши любимые стикеры:',
    MenuBuilder.getFavoritesMenu()
  );
}

// 📚 МЕНЮ ПОДБОРОК
async function showCollectionsMenu(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '📚 *Ваши подборки*\n\n' +
    'Создавайте тематические коллекции стикеров:',
    MenuBuilder.getCollectionsMenu()
  );
}

// 🖼️ ОБРАБОТКА ФОТО
async function handlePhoto(BOT_URL, chatId, photos, username) {
  await sendMessage(BOT_URL, chatId, '🔄 *Скачиваю фото...*', MenuBuilder.removeMenu());
  
  const bestPhoto = photos[photos.length - 1];
  const fileUrl = await getFileUrl(BOT_URL, bestPhoto.file_id);
  
  // Сохраняем фото в сессии
  userSessions[chatId] = {
    photoUrl: fileUrl,
    waitingFor: 'effect_selection'
  };
  
  await sendMessage(BOT_URL, chatId,
    '✅ *Фото получено!*\n\n' +
    '🎭 *Выберите эффект:*\n' +
    '• Винтаж\n' +
    '• Черно-белый\n' +
    '• Сепия\n' +
    '• Пикселизация\n' +
    '• Размытие\n\n' +
    '📝 *Напишите название эффекта*',
    MenuBuilder.removeMenu()
  );
  
  console.log(`📸 ${username} отправил фото: ${fileUrl}`);
}

// 📎 ОБРАБОТКА ДОКУМЕНТА
async function handleDocument(BOT_URL, chatId, document, username) {
  await sendMessage(BOT_URL, chatId, '🔄 *Загружаю изображение...*', MenuBuilder.removeMenu());
  
  const fileUrl = await getFileUrl(BOT_URL, document.file_id);
  
  userSessions[chatId] = {
    photoUrl: fileUrl,
    waitingFor: 'effect_selection'
  };
  
  await sendMessage(BOT_URL, chatId,
    '✅ *Изображение загружено!*\n\n' +
    '✨ *Выберите эффект:*\n' +
    '• Винтаж\n' +
    '• Черно-белый\n' +
    '• Сепия\n' +
    '• Пикселизация\n' +
    '• Размытие\n\n' +
    '📝 *Напишите название эффекта*',
    MenuBuilder.removeMenu()
  );
}

// 🎭 ВЫБОР ЭФФЕКТА
async function handleEffectSelection(BOT_URL, chatId, effectName, username) {
  const session = userSessions[chatId];
  
  if (!session || !session.photoUrl) {
    await sendMessage(BOT_URL, chatId, '❌ *Сначала отправьте фото!*', MenuBuilder.getMainMenu());
    return;
  }
  
  await sendMessage(BOT_URL, chatId, `🎭 *Создаю стикер с эффектом "${effectName}"...*`, MenuBuilder.removeMenu());
  
  try {
    // Скачиваем изображение
    const imageBuffer = await downloadImage(session.photoUrl);
    
    // Имитация обработки
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Отправляем сообщение о успехе
    const stickerId = Date.now();
    await sendMessage(BOT_URL, chatId,
      `✅ *Стикер готов!* Эффект: *${effectName}*\n\n` +
      '✨ *Что дальше?*',
      MenuBuilder.getStickerActions(stickerId)
    );
    
    console.log(`🎨 Создан стикер для ${username}: ${effectName}`);
    
    // Очищаем сессию
    delete userSessions[chatId];
    
  } catch (error) {
    console.error('❌ Ошибка создания:', error);
    await sendMessage(BOT_URL, chatId, '❌ *Не удалось создать стикер. Попробуйте другое фото!*', MenuBuilder.getMainMenu());
  }
}

// 📤 ОТПРАВКА СООБЩЕНИЯ
async function sendMessage(BOT_URL, chatId, text, options = {}) {
  try {
    await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      })
    });
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.message);
  }
}

// 🔗 ПОЛУЧЕНИЕ URL ФАЙЛА
async function getFileUrl(BOT_URL, fileId) {
  try {
    const response = await fetch(`${BOT_URL}/getFile?file_id=${fileId}`);
    const data = await response.json();
    return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
  } catch (error) {
    console.error('❌ Ошибка получения файла:', error);
    return null;
  }
}
// 🎭 ВЫБОР ЭФФЕКТА И РЕАЛЬНОЕ СОЗДАНИЕ СТИКЕРА
async function handleEffectSelection(BOT_URL, chatId, effectName, username) {
  const session = userSessions[chatId];
  
  if (!session || !session.photoUrl) {
    await sendMessage(BOT_URL, chatId, '❌ *Сначала отправьте фото!*', MenuBuilder.getMainMenu());
    return;
  }
  
  await sendMessage(BOT_URL, chatId, `🎭 *Создаю стикер с эффектом "${effectName}"...*`, MenuBuilder.removeMenu());
  
  try {
    const imageBuffer = await stickerCreator.downloadImage(session.photoUrl);
    
    // Настройки для разных эффектов
    const options = {};
    
    if (effectName.includes('Текст')) {
      options.text = 'Cool!';
      effectName = 'текст';
    } else if (effectName.includes('Золотая рамка')) {
      options.frameColor = 'gold';
      effectName = 'рамка';
    } else if (effectName.includes('Радужная рамка')) {
      options.frameColor = 'rainbow';
      effectName = 'рамка';
    } else if (effectName === 'Градиент') {
      options.gradientColor = 'rgba(255,105,180,0.3)';
    }
    
    // Создаем стикер с эффектом
    const stickerBuffer = await stickerCreator.createSticker(imageBuffer, effectName, options);
    
    // Отправляем стикер
    await stickerCreator.sendSticker(process.env.TELEGRAM_BOT_TOKEN, chatId, stickerBuffer);
    
    // Меню действий
    const stickerId = Date.now();
    await sendMessage(BOT_URL, chatId,
      `✅ *Стикер готов!* Эффект: *${effectName}*\n\n` +
      '✨ *Что дальше?*',
      MenuBuilder.getStickerActions(stickerId)
    );
    
    console.log(`🎨 Создан стикер для ${username}: ${effectName}`);
    delete userSessions[chatId];
    
  } catch (error) {
    console.error('❌ Ошибка создания:', error);
    await sendMessage(BOT_URL, chatId, 
      '❌ *Не удалось создать стикер*\nПопробуйте другое фото или эффект!',
      MenuBuilder.getMainMenu()
    );
  }
}
// 🔙 ОТВЕТ НА CALLBACK QUERY
async function answerCallbackQuery(BOT_URL, callbackId, text = '') {
  try {
    await fetch(`${BOT_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text,
        show_alert: !!text
      })
    });
  } catch (error) {
    console.error('❌ Ошибка ответа на callback:', error.message);
  }
}
