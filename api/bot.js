// ⚡ TELEGRAM БОТ ДЛЯ СОЗДАНИЯ СТИКЕРОВ
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Sticker Bot работает!',
      features: 'Создание стикеров, эффекты, избранное',
      commands: '/start, /help, /effects, /stats'
    });
  }

  if (req.method === 'POST') {
    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN) throw new Error('Токен не настроен');

      const update = req.body;
      const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

      // 📨 Обработка сообщения
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        const username = update.message.from?.username || 'Пользователь';

        // 🎯 КОМАНДЫ
        if (text === '/start') {
          await sendMessage(BOT_URL, chatId, 
            `👋 *Привет, ${username}!* 🎨\n\n` +
            'Я *Sticker Bot* - создаю крутые стикеры из твоих фото!\n\n' +
            '🌟 *Что умею:*\n' +
            '• Создавать стикеры из изображений\n' +
            '• Применять эффекты (винтаж, ЧБ, сепия)\n' +
            '• Сохранять в избранное\n' +
            '• Показывать рейтинг\n\n' +
            '📸 *Просто отправь мне фото!*\n\n' +
            '💡 *Команды:* /help /effects /stats'
          );
        }
        else if (text === '/help') {
          await sendMessage(BOT_URL, chatId,
            '📖 *Помощь по Sticker Bot:*\n\n' +
            '🎨 *Создать стикер:*\n' +
            'Отправь любое изображение (фото/PNG/JPG)\n\n' +
            '🎭 *Эффекты:*\n' +
            'После создания выбери эффект из меню\n\n' +
            '⭐ *Избранное:*\n' +
            'Сохраняй лучшие стикеры кнопкой "⭐"\n\n' +
            '🏆 *Рейтинг:*\n' +
            '/stats - твоя статистика\n' +
            '/top - топ пользователей\n\n' +
            '💎 *Эффекты:* /effects\n' +
            '📊 *Статистика:* /stats'
          );
        }
        else if (text === '/effects' || text === '🎭 эффекты') {
          await sendMessage(BOT_URL, chatId,
            '🎭 *Доступные эффекты:*\n\n' +
            '• *Без эффекта* - оригинальное изображение\n' +
            '• *Винтаж* - старинный вид\n' +
            '• *Черно-белый* - классический ЧБ\n' +
            '• *Сепия* - коричневый оттенок\n' +
            '• *Пикселизация* - ретро-стиль\n' +
            '• *Размытие* - мягкий эффект\n\n' +
            '📸 *Отправь фото, затем выбери эффект!*'
          );
        }
        else if (text === '/stats' || text === '📊 статистика') {
          // Простая статистика (пока заглушка)
          await sendMessage(BOT_URL, chatId,
            `📊 *Статистика @${username}:*\n\n` +
            '🎨 Создано стикеров: *0*\n' +
            '⭐ В избранном: *0*\n' +
            '🏆 Место в рейтинге: *-\*\n\n' +
            '_База данных скоро будет подключена_'
          );
        }
        else if (text === '/top' || text === '🏆 топ') {
          await sendMessage(BOT_URL, chatId,
            '🏆 *Топ создателей стикеров:*\n\n' +
            '🥇 Пока никто не создал стикеров\n' +
            '🥈 Будь первым!\n' +
            '🥉 Отправь фото прямо сейчас!\n\n' +
            '📸 *Создай свой первый стикер!*'
          );
        }
        // 📸 ОБРАБОТКА ФОТО
        else if (update.message.photo) {
          await sendMessage(BOT_URL, chatId, '🔄 *Создаю стикер...*');
          
          // Получаем самое качественное фото
          const photos = update.message.photo;
          const bestPhoto = photos[photos.length - 1];
          
          // Получаем URL файла
          const fileUrl = await getFileUrl(BOT_URL, bestPhoto.file_id);
          
          // Скачиваем изображение (упрощенно)
          await sendMessage(BOT_URL, chatId, 
            '✅ *Фото получено!*\n\n' +
            '🎭 *Выбери эффект:*\n' +
            '1. Без эффекта\n' +
            '2. Винтаж\n' +
            '3. Черно-белый\n' +
            '4. Сепия\n\n' +
            '📝 *Отправь цифру или название эффекта*'
          );
          
          console.log(`📸 Пользователь ${username} отправил фото: ${fileUrl}`);
        }
        // 📎 ОБРАБОТКА ДОКУМЕНТОВ (изображений)
        else if (update.message.document && 
                 update.message.document.mime_type?.startsWith('image/')) {
          await sendMessage(BOT_URL, chatId, '🔄 *Обрабатываю изображение...*');
          
          const fileUrl = await getFileUrl(BOT_URL, update.message.document.file_id);
          
          await sendMessage(BOT_URL, chatId,
            '✅ *Изображение загружено!*\n\n' +
            '✨ *Доступные эффекты:*\n' +
            '• винтаж\n' +
            '• черно-белый\n' +
            '• сепия\n' +
            '• пикселизация\n\n' +
            '📝 *Напиши название эффекта*'
          );
        }
        // 🎭 ВЫБОР ЭФФЕКТА
        else if (['винтаж', 'черно-белый', 'сепия', 'пикселизация', 'размытие', '1', '2', '3', '4'].includes(text.toLowerCase())) {
          const effectMap = {
            '1': 'без эффекта', '2': 'винтаж', '3': 'черно-белый', '4': 'сепия',
            'винтаж': 'винтаж', 'черно-белый': 'черно-белый', 
            'сепия': 'сепия', 'пикселизация': 'пикселизация', 'размытие': 'размытие'
          };
          
          const effect = effectMap[text.toLowerCase()] || 'без эффекта';
          
          // Имитация создания стикера
          await sendMessage(BOT_URL, chatId, `🎭 *Применяю эффект "${effect}"...*`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Отправляем сообщение со стикером (заглушка)
          await sendMessage(BOT_URL, chatId,
            `✅ *Стикер готов!* Эффект: *${effect}*\n\n` +
            '⭐ *Что дальше?*\n' +
            '• Отправь новое фото\n' +
            '• /effects - другие эффекты\n' +
            '• /stats - статистика\n\n' +
            '_В следующем обновлении: реальные стикеры и избранное!_'
          );
          
          console.log(`🎨 Создан стикер для ${username} с эффектом: ${effect}`);
        }
        // 💬 ЛЮБОЙ ДРУГОЙ ТЕКСТ
        else if (text) {
          await sendMessage(BOT_URL, chatId,
            '🎨 *Sticker Bot*\n\n' +
            'Отправь мне изображение для создания стикера!\n\n' +
            '📸 *Поддерживаются:*\n' +
            '• Фото из Telegram\n' +
            '• PNG, JPG, JPEG файлы\n\n' +
            '💡 *Команды:*\n' +
            '/start - начало\n' +
            '/help - помощь\n' +
            '/effects - эффекты\n' +
            '/stats - статистика\n' +
            '/top - рейтинг'
          );
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

// 📤 ОТПРАВКА СООБЩЕНИЯ
async function sendMessage(BOT_URL, chatId, text) {
  try {
    await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
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
