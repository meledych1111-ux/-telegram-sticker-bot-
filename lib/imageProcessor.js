// 🎨 ОБРАБОТКА ИЗОБРАЖЕНИЙ С JIMP
const Jimp = require('jimp');

// 📥 Скачивание изображения
async function downloadImage(url) {
  console.log('📥 Скачиваю изображение...');
  try {
    const response = await fetch(url, { timeout: 30000 });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('❌ Ошибка скачивания изображения:', error.message);
    throw error;
  }
}

// 🎭 ПРИМЕНЕНИЕ ЭФФЕКТОВ
async function applyEffect(imageBuffer, effectName) {
  try {
    console.log(`🎭 Применяю эффект: ${effectName}`);
    
    const image = await Jimp.read(imageBuffer);
    
    switch (effectName) {
      case 'vintage':
        image.sepia().color([{ apply: 'mix', params: ['#FFE4C4', 30] }]);
        break;
        
      case 'grayscale':
        image.greyscale();
        break;
        
      case 'sepia':
        image.sepia();
        break;
        
      case 'pixelate':
        image.pixelate(10);
        break;
        
      case 'blur':
        image.blur(3);
        break;
        
      case 'none':
      default:
        // Без эффекта
        break;
    }
    
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    console.error(`❌ Ошибка применения эффекта ${effectName}:`, error);
    return imageBuffer;
  }
}

// 🎨 Создание стикера
async function createSticker(imageBuffer, effect = 'none') {
  try {
    console.log(`🎨 Создаю стикер с эффектом: ${effect}`);
    
    // Загружаем изображение
    const image = await Jimp.read(imageBuffer);
    
    // Обрезаем до квадрата
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    image.cover(size, size);
    
    // Ресайз до 512x512
    image.resize(512, 512);
    
    // Применяем эффект
    let processedBuffer;
    if (effect !== 'none') {
      processedBuffer = await applyEffect(await image.getBufferAsync(Jimp.MIME_PNG), effect);
    } else {
      processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
    }
    
    // Оптимизируем размер (упрощенно)
    let quality = 80;
    let optimizedBuffer = processedBuffer;
    
    while (optimizedBuffer.length > 512 * 1024 && quality > 40) {
      const tempImage = await Jimp.read(optimizedBuffer);
      optimizedBuffer = await tempImage.quality(quality).getBufferAsync(Jimp.MIME_PNG);
      quality -= 10;
    }
    
    console.log(`✅ Стикер создан! Эффект: ${effect}, Размер: ${optimizedBuffer.length} байт`);
    return optimizedBuffer;

  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error);
    
    // Fallback
    try {
      const fallbackImage = await Jimp.read(imageBuffer);
      fallbackImage.resize(512, 512);
      return await fallbackImage.getBufferAsync(Jimp.MIME_PNG);
    } catch (fallbackError) {
      throw new Error('Не удалось обработать изображение');
    }
  }
}

module.exports = {
  downloadImage,
  createSticker,
  applyEffect
};
