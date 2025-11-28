// 📞 ОБРАБОТКА СООБЩЕНИЙ ОТ TELEGRAM API
const axios = require('axios');
const { downloadImage, createSticker } = require('./imageProcessor');

// Токен бота из переменных окружения Vercel
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Проверка что токен существует
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен в переменных окружения Vercel');
}

class TelegramAPI {
  
  // 📨 Обработка входящего сообщения от Telegram API
  async processMessage(update) {
    if (!update.message) return;

    const message = update.message;
    const chatId = message.chat.id;

    try {
      // Проверяем что токен установлен
      if (!BOT_TOKEN) {
        await this.sendMessage(chatId, '❌ Бот не настроен. Проверьте переменные окружения.');
        return;
      }

      // Текстовые сообщения (команды)
      if (message.text) {
        await this.handleTextMessage(chatId, message.text);
        return;
      }

      // Фотографии
      if (message.photo) {
        await this.handlePhoto(chatId, message.photo);
        return;
      }

      // Документы (файлы)
      if (message.document) {
        await this.handleDocument(chatId, message.document);
        return;
      }

    } catch (error) {
      console.error('❌ Ошибка обработки сообщения:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при обработке сообщения. Попробуйте еще раз.');
    }
  }

  // 📝 Обработка текстовых команд от Telegram API
  async handleTextMessage(chatId, text) {
    switch (text) {
      case '/start':
        await this.sendWelcomeMessage(chatId);
        break;
      case '/help':
        await this.sendHelpMessage(chatId);
        break;
      default:
        await this.sendMessage(chatId, 
          '📷 Отправьте мне изображение, и я создам из него стикер!\n' +
          'Используйте /help для инструкций.'
        );
    }
  }

  // 🖼️ Обработка фотографий через Telegram API
  async handlePhoto(chatId, photos) {
    await this.sendMessage(chatId, '🔄 Обрабатываю изображение...');

    try {
      // Берем фото самого высокого качества (последнее в массиве)
      const photo = photos[photos.length - 1];
      const fileUrl = await this.getFileUrl(photo.file_id);
      
      // Скачиваем и создаем стикер
      const imageBuffer = await downloadImage(fileUrl);
      const stickerBuffer = await createSticker(imageBuffer);
      
      // Отправляем результат через Telegram API
      await this.sendSticker(chatId, stickerBuffer);
      await this.sendMessage(chatId, '✅ Стикер готов! Можно отправлять следующее изображение.');

    } catch (error) {
      console.error('❌ Ошибка обработки фото:', error);
      await this.sendMessage(chatId, '❌ Не удалось обработать изображение. Попробуйте другой файл.');
    }
  }

  // 📎 Обработка документов через Telegram API
  async handleDocument(chatId, document) {
    const mimeType = document.mime_type;

    // Проверяем что это изображение
    if (!mimeType || !mimeType.startsWith('image/')) {
      await this.sendMessage(chatId, '❌ Пожалуйста, отправьте изображение (PNG, JPG, JPEG)');
      return;
    }

    await this.sendMessage(chatId, '🔄 Обрабатываю изображение...');

    try {
      const fileUrl = await this.getFileUrl(document.file_id);
      const imageBuffer = await downloadImage(fileUrl);
      const stickerBuffer = await createSticker(imageBuffer);
      
      await this.sendSticker(chatId, stickerBuffer);
      await this.sendMessage(chatId, '✅ Стикер готов!');

    } catch (error) {
      console.error('❌ Ошибка обработки документа:', error);
      await this.sendMessage(chatId, '❌ Не удалось создать стикер. Попробуйте другое изображение.');
    }
  }

  // 👋 Приветственное сообщение
  async sendWelcomeMessage(chatId) {
    const message = 
      '👋 Привет! Я @MyStickerMakertBot - бот для создания стикеров!\n\n' +
      '🎨 Что я умею:\n' +
      '• Создавать стикеры из ваших изображений\n' + 
      '• Автоматически обрабатывать изображения\n' +
      '• Подготавливать стикеры для Telegram API\n\n' +
      '📸 Как использовать:\n' +
      '1. Отправьте мне любое изображение\n' +
      '2. Я обработаю его через Telegram Bot API\n' +
      '3. Вы получите готовый стикер!\n\n' +
      '🚀 Просто отправьте изображение и попробуйте!';

    await this.sendMessage(chatId, message);
  }

  // 📖 Сообщение помощи
  async sendHelpMessage(chatId) {
    const message =
      '📖 Инструкция по использованию @MyStickerMakertBot:\n\n' +
      '🖼️ Поддерживаемые форматы:\n' +
      '• PNG, JPG, JPEG изображения\n' +
      '• Максимальный размер: 10MB\n\n' +
      '⚡ Просто отправьте изображение - я все сделаю автоматически через Telegram Bot API!';

    await this.sendMessage(chatId, message);
  }

  // 📤 Отправка текстового сообщения через Telegram API
  async sendMessage(chatId, text) {
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
  async sendSticker(chatId, stickerBuffer) {
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
  async getFileUrl(fileId) {
    try {
      const response = await axios.get(`${BOT_URL}/getFile?file_id=${fileId}`);
      const filePath = response.data.result.file_path;
      return `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    } catch (error) {
      console.error('❌ Ошибка получения файла:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Создаем и экспортируем экземпляр класса
module.exports = new TelegramAPI();
