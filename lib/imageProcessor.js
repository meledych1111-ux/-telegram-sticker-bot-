// 🎨 ОБРАБОТКА ИЗОБРАЖЕНИЙ ДЛЯ СТИКЕРОВ

const axios = require('axios');
const sharp = require('sharp');

class ImageProcessor {
  
  // 📥 Скачивание изображения по URL
  async downloadImage(url) {
    console.log('📥 Скачиваю изображение...');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    return Buffer.from(response.data);
  }

  // 🎨 Создание стикера из изображения
  async createSticker(imageBuffer) {
    try {
      console.log('🎨 Создаю стикер...');
      
      // Обрабатываем изображение для стикера
      const processedImage = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',          // Вписываем в квадрат 512x512
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Прозрачный фон
        })
        .png()                     // Конвертируем в PNG
        .toBuffer();

      // Оптимизируем размер файла
      const optimizedSticker = await this.optimizeStickerSize(processedImage);
      
      console.log(`✅ Стикер создан! Размер: ${optimizedSticker.length} байт`);
      return optimizedSticker;

    } catch (error) {
      console.error('❌ Ошибка создания стикера:', error);
      throw new Error('Не удалось обработать изображение');
    }
  }

  // 📦 Оптимизация размера стикера (макс. 512KB для Telegram)
  async optimizeStickerSize(stickerBuffer) {
    const maxSize = 512 * 1024; // 512KB - максимальный размер для Telegram

    // Если изначально меньше максимального размера - возвращаем как есть
    if (stickerBuffer.length <= maxSize) {
      return stickerBuffer;
    }

    console.log('📦 Оптимизирую размер стикера...');
    let quality = 90;
    let optimizedBuffer = stickerBuffer;

    // Уменьшаем качество пока размер не станет допустимым
    while (optimizedBuffer.length > maxSize && quality > 30) {
      optimizedBuffer = await sharp(stickerBuffer)
        .png({
          quality: quality,       // Качество PNG
          compressionLevel: 9     // Максимальное сжатие
        })
        .toBuffer();
      
      quality -= 10;
    }

    // Если все еще слишком большой, уменьшаем размер изображения
    if (optimizedBuffer.length > maxSize) {
      console.log('🖼️ Уменьшаю размер изображения...');
      optimizedBuffer = await sharp(stickerBuffer)
        .resize(400, 400, {      // Уменьшаем до 400x400
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
