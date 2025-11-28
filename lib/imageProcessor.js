// 🎨 ПРОСТАЯ ОБРАБОТКА ИЗОБРАЖЕНИЙ - ОБРЕЗКА ПО КВАДРАТУ
const axios = require('axios');
const sharp = require('sharp');

// 📥 Скачивание изображения по URL от Telegram API
async function downloadImage(url) {
  console.log('📥 Скачиваю изображение...');
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000
  });
  return Buffer.from(response.data);
}

// 📦 Оптимизация размера стикера
async function optimizeStickerSize(stickerBuffer) {
  const maxSize = 512 * 1024; // 512KB максимум для Telegram

  if (stickerBuffer.length <= maxSize) {
    return stickerBuffer;
  }

  console.log('📦 Оптимизирую размер... Текущий:', stickerBuffer.length, 'байт');
  let quality = 80;
  let optimizedBuffer = stickerBuffer;

  // Уменьшаем качество пока не влезет в лимит
  while (optimizedBuffer.length > maxSize && quality > 40) {
    optimizedBuffer = await sharp(stickerBuffer)
      .png({ 
        quality: quality,
        compressionLevel: 9 
      })
      .toBuffer();
    quality -= 10;
    console.log('Качество:', quality, 'Размер:', optimizedBuffer.length, 'байт');
  }

  console.log('✅ Оптимизация завершена. Финальный размер:', optimizedBuffer.length, 'байт');
  return optimizedBuffer;
}

// 🎨 Создание стикера - ПРОСТАЯ ОБРЕЗКА ПО ЦЕНТРУ
async function createSticker(imageBuffer) {
  try {
    console.log('🎨 Создаю стикер (простая обрезка)...');
    
    // Получаем информацию об изображении
    const metadata = await sharp(imageBuffer).metadata();
    console.log('Исходное изображение:', metadata.width, 'x', metadata.height);
    
    // Определяем размер для обрезки (берем меньшую сторону)
    const size = Math.min(metadata.width, metadata.height);
    const left = Math.floor((metadata.width - size) / 2);
    const top = Math.floor((metadata.height - size) / 2);
    
    console.log('Обрезка квадрата:', size, 'x', size, 'позиция:', left, ',', top);
    
    // Обрезаем по центру и resize до 512x512
    const processedImage = await sharp(imageBuffer)
      .extract({
        left: left,
        top: top,
        width: size,
        height: size
      })
      .resize(512, 512, {
        fit: 'cover',  // Заполняем весь квадрат
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Прозрачный фон
      })
      .png()
      .toBuffer();
    
    // Оптимизируем размер
    const optimizedSticker = await optimizeStickerSize(processedImage);
    
    console.log('✅ Стикер создан! Размер:', optimizedSticker.length, 'байт');
    return optimizedSticker;

  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error);
    
    // Fallback: простая версия если обрезка не работает
    try {
      console.log('🔄 Пробую упрощенную версию...');
      const simpleSticker = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      const optimized = await optimizeStickerSize(simpleSticker);
      return optimized;
    } catch (fallbackError) {
      console.error('❌ Упрощенная версия тоже не сработала:', fallbackError);
      throw new Error('Не удалось обработать изображение: ' + error.message);
    }
  }
}

// Экспортируем функции
module.exports = {
  downloadImage,
  createSticker,
  optimizeStickerSize
};
