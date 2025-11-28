// 🎨 ОБРАБОТКА ИЗОБРАЖЕНИЙ ДЛЯ TELEGRAM STICKERS
const axios = require('axios');
const sharp = require('sharp');

class ImageProcessor {
  
  // 📥 Скачивание изображения по URL от Telegram API
  async downloadImage(url) {
    console.log('📥 Скачиваю изображение из Telegram API...');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    return Buffer.from(response.data);
  }

  // 🎨 Создание стикера для Telegram API
  async createSticker(imageBuffer) {
    try {
      console.log('🎨 Создаю стикер для Telegram...');
      
      // Обрабатываем изображение для стикера (требования Telegram API)
      const processedImage = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',          // Вписываем в квадрат 512x512 (требование Telegram)
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Прозрачный фон для стикеров
        })
        .png()                     // Конвертируем в PNG (формат для Telegram стикеров)
        .toBuffer();

      // Оптимизируем размер файла для Telegram API (макс. 512KB)
      const optimizedSticker = await this.optimizeStickerSize(processedImage);
      
      console.log(`✅ Стикер создан для Telegram! Размер: ${optimizedSticker.length} байт`);
      return optimizedSticker;

    } catch (error) {
      console.error('❌ Ошибка создания стикера для Telegram:', error);
      throw new Error('Не удалось обработать изображение для Telegram API');
    }
  }

  // 📦 Оптимизация размера стикера для Telegram API (макс. 512KB)
  async optimizeStickerSize(stickerBuffer) {
    const maxSize = 512 * 1024; // 512KB - максимальный размер для Telegram API

    // Если изначально меньше максимального размера - возвращаем как есть
    if (stickerBuffer.length <= maxSize) {
      return stickerBuffer;
    }

    console.log('📦 Оптимизирую размер стикера для Telegram API...');
    let quality = 90;
    let optimizedBuffer = stickerBuffer;

    // Уменьшаем качество пока размер не станет допустимым для Telegram
    while (optimizedBuffer.length > maxSize && quality > 30) {
      optimizedBuffer = await sharp(stickerBuffer)
        .png({
          quality: quality,       // Качество PNG
          compressionLevel: 9     // Максимальное сжатие для Telegram
        })
        .toBuffer();
      
      quality -= 10;
    }

    // Если все еще слишком большой для Telegram API, уменьшаем размер изображения
    if (optimizedBuffer.length > maxSize) {
      console.log('🖼️ Уменьшаю размер изображения для Telegram API...');
      optimizedBuffer = await sharp(stickerBuffer)
        .resize(400, 400, {      // Уменьшаем до 400x400 для Telegram
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({
          compressionLevel: 9
        })
        .toBuffer();
    }

    return optimizedBuffer;
  }
}

// Создаем и экспортируем экземпляр класса
module.exports = new ImageProcessor();
