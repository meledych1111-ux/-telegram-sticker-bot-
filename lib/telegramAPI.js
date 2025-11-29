// 📞 ОБРАБОТКА СООБЩЕНИЙ ОТ TELEGRAM API
const axios = require('axios');
const { downloadImage, createSticker } = require('./imageProcessor');
const { saveUser, saveSticker, getUserStats, getTopUsers } = require('./database');

// Токен бота из переменных окружения Vercel
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Проверка что токен существует
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен в переменных окружения Vercel');
}

// 📨 Обработка входящего сообщения от Telegram API
async function processMessage(update) {
  if (!update.message) return;

  const message = update.message;
  const chatId = message.chat.id;
  const username = message.from?.username;
  const firstName = message.from?.first_name;

  try {
    // Проверяем что токен установлен
    if (!BOT_TOKEN) {
      await sendMessage(chatId, '❌ Бот не настроен. Проверьте переменные окружения.');
      return;
    }

    // 💾 СОХРАНЯЕМ ПОЛЬЗОВАТЕЛЯ В БАЗУ
    await saveUser(chatId, username, firstName);

    // Текстовые сообщения (команды)
    if (message.text) {
      await handleTextMessage(chatId, message.text);
      return;
    }

    // Фотографии
    if (message.photo) {
      await handlePhoto(chatId, message.photo);
      return;
    }

    // Документы (файлы)
    if (message.document) {
      await handleDocument(chatId, message.document);
      return;
    }

  } catch (error) {
    console.error('❌ Ошибка обработки сообщения:', error);
    await sendMessage(chatId, '❌ Произошла ошибка при обработке сообщения. Попробуйте еще раз.');
  }
}

// 📝 Обработка текстовых команд от Telegram API
async function handleTextMessage(chatId, text) {
  switch (text) {
    case '/start':
      await sendWelcomeMessage(chatId);
      break;
      
    case '/help':
      await sendHelpMessage(chatId);
      break;
      
    case '/stats':
      try {
        const stats = await getUserStats(chatId);
        await sendMessage(chatId, 
          `📊 Ваша статистика:\n` +
          `🎨 Создано стикеров: ${stats.total_stickers}\n` +
          `📅 Сегодня: ${stats.today_stickers}`
        );
      } catch (error) {
        console.error('❌ Ошибка получения статистики:', error);
        await sendMessage(chatId, '📊 Статистика временно недоступна');
      }
      break;
      
    case '/top':
      try {
        const topUsers = await getTopUsers();
        let message = '🏆 Топ создателей стикеров:\n\n';
        
        if (topUsers.length === 0) {
          message += 'Пока никто не создал стикеров 😢\nБудь первым!';
        } else {
          topUsers.forEach((user, index) => {
            const name = user.username ? `@${user.username}` : user.first_name || 'Аноним';
            message += `${index + 1}. ${name} - ${user.stickers_created} стикеров\n`;
          });
        }
        
        await sendMessage(chatId, message);
      } catch (error) {
        console.error('❌ Ошибка получения топа:', error);
        await sendMessage(chatId, '🏆 Рейтинг временно недоступен');
      }
      break;
      
    default:
      await sendMessage(chatId, 
        '📷 Отправьте мне изображение для создания стикера!\n\n' +
        '📊 Команды:\n' +
        '/stats - ваша статистика\n' +
        '/top - топ пользователей\n' +
        '/help - помощь'
      );
  }
}

// 🖼️ Обработка фотографий через Telegram API
async function handlePhoto(chatId, photos) {
  const startTime = Date.now();
  
  await sendMessage(chatId, '🔄 Обрабатываю изображение...');

  try {
    // Берем фото самого высокого качества (последнее в массиве)
    const photo = photos[photos.length - 1];
    const fileUrl = await getFileUrl(photo.file_id);
    
    // Скачиваем и создаем стикер
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer);
    
    // 💾 СОХРАНЯЕМ ИНФОРМАЦИЮ О СТИКЕРЕ
    const processingTime = Date.now() - startTime;
    await saveSticker(chatId, 'photo', stickerBuffer.length, processingTime);
    
    // Отправляем результат через Telegram API
    await sendSticker(chatId, stickerBuffer);
    await sendMessage(chatId, '✅ Стикер готов! Можно отправлять следующее изображение.');

  } catch (error) {
    console.error('❌ Ошибка обработки фото:', error);
    await sendMessage(chatId, '❌ Не удалось обработать изображение. Попробуйте другой файл.');
  }
}

// 📎 Обработка документов через Telegram API
async function handleDocument(chatId, document) {
  const startTime = Date.now();
  const mimeType = document.mime_type;

  // Проверяем что это изображение
  if (!mimeType || !mimeType.startsWith('image/')) {
    await sendMessage(chatId, '❌ Пожалуйста, отправьте изображение (PNG, JPG, JPEG)');
    return;
  }

  await sendMessage(chatId, '🔄 Обрабатываю изображение...');

  try {
    const fileUrl = await getFileUrl(document.file_id);
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer);
    
    // 💾 СОХРАНЯЕМ ИНФОРМАЦИЮ О СТИКЕРЕ
    const processingTime = Date.now() - startTime;
    await saveSticker(chatId, 'document', stickerBuffer.length, processingTime);
    
    await sendSticker(chatId, stickerBuffer);
    await sendMessage(chatId, '✅ Стикер готов!');

  } catch (error) {
    console.error('❌ Ошибка обработки документа:', error);
    await sendMessage(chatId, '❌ Не удалось создать стикер. Попробуйте другое изображение.');
  }
}

// 👋 Приветственное сообщение
async function sendWelcomeMessage(chatId) {
  const message = 
    '👋 Привет! Я @MyStickerMakertBot - бот для создания стикеров!\n\n' +
    '🎨 Что я умею:\n' +
    '• Создавать стикеры из ваших изображений\n' + 
    '• Автоматически обрабатывать изображения\n' +
    '• Подготавливать стикеры для Telegram API\n\n' +
    '📸 Как использовать:\n' +
    '1. Отправьте мне любое изображение\n' +
    '2. Я обработаю его через Vercel и Telegram Bot API\n' +
    '3. Вы получите готовый стикер!\n\n' +
    '📊 Новые команды:\n' +
    '/stats - ваша статистика\n' +
    '/top - топ пользователей\n\n' +
    '🚀 Просто отправьте изображение и попробуйте!';

  await sendMessage(chatId, message);
}

// 📖 Сообщение помощи
async function sendHelpMessage(chatId) {
  const message =
    '📖 Инструкция по использованию @MyStickerMakertBot:\n\n' +
    '🖼️ Поддерживаемые форматы:\n' +
    '• PNG, JPG, JPEG изображения\n' +
    '• Максимальный размер: 10MB\n\n' +
    '📊 Команды:\n' +
    '/stats - ваша статистика\n' +
    '/top - топ пользователей\n\n' +
    '⚡ Просто отправьте изображение - я все сделаю автоматически!';

  await sendMessage(chatId, message);
}

// 📤 Отправка текстового сообщения через Telegram API
async function sendMessage(chatId, text) {
  try {
    await axios.post(`${BOT_URL}/sendMessage`, {
      chat_id: chatId,
      text: text
    });
  } catch (error) {
    console.error('❌ Ошибка отправки сообщения:', error.response?.data || error.message);
  }
}

// 🎨 Отправка стикера через Telegram API
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

// 🔗 Получение URL файла через Telegram API
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

// Экспортируем функции
module.exports = {
  processMessage,
  handleTextMessage,
  handlePhoto,
  handleDocument,
  sendMessage,
  sendSticker,
  getFileUrl,
  sendWelcomeMessage,
  sendHelpMessage
};
