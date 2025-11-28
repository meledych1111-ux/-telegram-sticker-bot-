const axios = require('axios');
const sharp = require('sharp');

class ImageProcessor {
  async downloadImage(url) {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    return Buffer.from(response.data);
  }

  async createSticker(imageBuffer) {
    try {
      // Сначала обрабатываем изображение
      const processedImage = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

      // Оптимизируем размер
      const optimizedSticker = await this.optimizeStickerSize(processedImage);
      
      return optimizedSticker;

    } catch (error) {
      console.error('Error creating sticker:', error);
      throw new Error('Не удалось обработать изображение');
    }
  }

  async optimizeStickerSize(stickerBuffer) {
    const maxSize = 512 * 1024; // 512KB
    let quality = 90;
    let optimizedBuffer = stickerBuffer;

    // Если изначально меньше максимального размера - возвращаем как есть
    if (stickerBuffer.length <= maxSize) {
      return stickerBuffer;
    }

    // Пытаемся уменьшить качество
    while (optimizedBuffer.length > maxSize && quality > 30) {
      optimizedBuffer = await sharp(stickerBuffer)
        .png({
          quality: quality,
          compressionLevel: 9
        })
        .toBuffer();
      
      quality -= 10;
    }

    // Если все еще слишком большой, уменьшаем размер
    if (optimizedBuffer.length > maxSize) {
      optimizedBuffer = await sharp(stickerBuffer)
        .resize(400, 400, {
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

  async simpleBackgroundRemove(imageBuffer) {
    // Упрощенное "удаление" фона - делаем прозрачные области
    const processed = await sharp(imageBuffer)
      .ensureAlpha() // Добавляем альфа-канал
      .png()
      .toBuffer();
      
    return processed;
  }
}

module.exports = new ImageProcessor();
