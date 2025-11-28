const axios = require('axios');
const { downloadImage, createSticker } = require('./imageProcessor');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

class TelegramAPI {
  async processMessage(update) {
    if (!update.message) return;

    const message = update.message;
    const chatId = message.chat.id;

    try {
      // Обработка команд
      if (message.text) {
        await this.handleTextMessage(chatId, message.text);
        return;
      }

      // Обработка фото
      if (message.photo) {
        await this.handlePhoto(chatId, message.photo);
        return;
      }

      // Обработка документа
      if (message.document) {
        await this.handleDocument(chatId, message.document);
        return;
      }

    } catch (error) {
      console.error('Error processing message:', error);
      await this.sendMessage(chatId, '❌ Произошла ошибка при обработке. Попробуйте еще раз.');
    }
  }

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
          'Используйте /help для получения инструкций.'
        );
    }
  }

  async handlePhoto(chatId, photos) {
    await this.sendMessage(chatId, '🔄 Обрабатываю изображение...');

    // Берем фото наивысшего качества
    const photo = photos[photos.length - 1];
    const fileUrl = await this.getFileUrl(photo.file_id);
    
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer);
    
    await this.sendSticker(chatId, stickerBuffer);
    await this.sendMessage(chatId, '✅ Стикер готов! Можете отправить еще изображение.');
  }

  async handleDocument(chatId, document) {
    const mimeType = document.mime_type;

    // Проверяем что это изображение
    if (!mimeType || !mimeType.startsWith('image/')) {
      await this.sendMessage(chatId, '❌ Пожалуйста, отправьте изображение (PNG, JPG, JPEG)');
      return;
    }

    await this.sendMessage(chatId, '🔄 Обрабатываю изображение...');

    const fileUrl = await this.getFileUrl(document.file_id);
    const imageBuffer = await downloadImage(fileUrl);
    const stickerBuffer = await createSticker(imageBuffer);
    
    await this.sendSticker(chatId, stickerBuffer);
    await this.sendMessage(chatId, '✅ Стикер готов! Можете отправить еще изображение.');
  }

  async sendWelcomeMessage(chatId) {
    const message = 
      '👋 Привет! Я бот для создания стикеров!\n\n' +
      '🎨 Что я умею:\n' +
      '• Создавать стикеры из ваших изображений\n' + 
      '• Автоматически обрабатывать фон\n' +
      '• Подготавливать стикеры по стандартам Telegram\n\n' +
      '📸 Как использовать:\n' +
      '1. Отправьте мне любое изображение\n' +
      '2. Я обработаю его и уберу фон\n' +
      '3. Вы получите готовый стикер!\n\n' +
      '🚀 Просто отправьте изображение и попробуйте!';

    await this.sendMessage(chatId, message);
  }

  async sendHelpMessage(chatId) {
    const message =
      '📖 Инструкция по использованию бота:\n\n' +
      '🖼️ Поддерживаемые форматы:\n' +
      '• PNG, JPG, JPEG изображения\n' +
      '• Максимальный размер: 10MB\n\n' +
      '📎 Рекомендации:\n' +
      '• Отправляйте изображения с четким объектом\n' +
      '• Контрастный фон обрабатывается лучше\n' +
      '• Для лучшего качества отправляйте файлом\n\n' +
      '⚡ Просто отправьте изображение - я все сделаю автоматически!\n\n' +
      '❓ Если возникли проблемы - попробуйте другое изображение.';

    await this.sendMessage(chatId, message);
  }

  async sendMessage(chatId, text) {
    await axios.post(`${BOT_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
  }

  async sendSticker(chatId, stickerBuffer) {
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
  }

  async getFileUrl(fileId) {
    const response = await axios.get(`${BOT_URL}/getFile?file_id=${fileId}`);
    const filePath = response.data.result.file_path;
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  }
}

module.exports = new TelegramAPI();
