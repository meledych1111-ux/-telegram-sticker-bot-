// lib/stickerCreator.js
const axios = require('axios');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const FormData = require('form-data');

async function downloadImage(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}

async function createSticker(imageBuffer) {
  try {
    console.log('🎨 Создаю стикер...');
    
    // Загружаем изображение
    const image = await loadImage(imageBuffer);
    
    // Создаем canvas 512x512 (стандарт для стикеров Telegram)
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    
    // Очищаем фон (прозрачный)
    ctx.clearRect(0, 0, 512, 512);
    
    // Рассчитываем размеры для вписывания в квадрат 512x512
    const ratio = Math.min(512 / image.width, 512 / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    const x = (512 - width) / 2;
    const y = (512 - height) / 2;
    
    // Рисуем изображение по центру
    ctx.drawImage(image, x, y, width, height);
    
    // Возвращаем PNG buffer
    const stickerBuffer = canvas.toBuffer('image/png');
    console.log(`✅ Стикер создан: ${stickerBuffer.length} байт`);
    
    return stickerBuffer;
    
  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error.message);
    throw error;
  }
}

async function sendSticker(botToken, chatId, stickerBuffer) {
  try {
    console.log(`📤 Отправляю стикер в чат ${chatId}...`);
    
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('sticker', stickerBuffer, { filename: 'sticker.png', contentType: 'image/png' });
    
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendSticker`,
      formData,
      { 
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    
    console.log('✅ Стикер отправлен');
    return response.data;
    
  } catch (error) {
    console.error('❌ Ошибка отправки стикера:', error.message);
    if (error.response) {
      console.error('❌ Ответ Telegram:', error.response.data);
    }
    throw error;
  }
}

module.exports = {
  downloadImage,
  createSticker,
  sendSticker
};
