// 🎨 ОБРАБОТКА ИЗОБРАЖЕНИЙ С ЭФФЕКТАМИ
const sharp = require('sharp');

// 📥 Скачивание изображения
async function downloadImage(url) {
  console.log('📥 Скачиваю изображение...');
  try {
    const response = await fetch(url, {
      timeout: 30000
    });
    
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
    
    let processedImage = imageBuffer;
    
    switch (effectName) {
      case 'vintage':
        processedImage = await sharp(imageBuffer)
          .modulate({ brightness: 0.9, saturation: 0.8 })
          .tint({ r: 255, g: 240, b: 200 })
          .toBuffer();
        break;
        
      case 'grayscale':
        processedImage = await sharp(imageBuffer)
          .grayscale()
          .toBuffer();
        break;
        
      case 'sepia':
        processedImage = await sharp(imageBuffer)
          .tint({ r: 255, g: 240, b: 192 })
          .toBuffer();
        break;
        
      case 'pixelate':
        const metadata = await sharp(imageBuffer).metadata();
        processedImage = await sharp(imageBuffer)
          .resize(Math.floor(metadata.width / 8), Math.floor(metadata.height / 8))
          .resize(metadata.width, metadata.height, { kernel: 'nearest' })
          .toBuffer();
        break;
        
      case 'blur':
        processedImage = await sharp(imageBuffer)
          .blur(5)
          .toBuffer();
        break;
        
      case 'none':
      default:
        // Без эффекта
        break;
    }
    
    return processedImage;
  } catch (error) {
    console.error(`❌ Ошибка применения эффекта ${effectName}:`, error);
    return imageBuffer; // Возвращаем оригинал при ошибке
  }
}

// 📦 Оптимизация размера стикера
async function optimizeStickerSize(stickerBuffer) {
  const maxSize = 512 * 1024;

  if (stickerBuffer.length <= maxSize) {
    return stickerBuffer;
  }

  console.log('📦 Оптимизирую размер...');
  let quality = 80;
  let optimizedBuffer = stickerBuffer;

  while (optimizedBuffer.length > maxSize && quality > 40) {
    optimizedBuffer = await sharp(stickerBuffer)
      .png({ quality: quality, compressionLevel: 9 })
      .toBuffer();
    quality -= 10;
  }

  return optimizedBuffer;
}

// 🧠 Умная обрезка
async function smartCrop(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
    const ratio = width / height;
    
    const size = Math.min(width, height);
    const left = Math.floor((width - size) / 2);
    const top = Math.floor((height - size) / 2);
    
    return await sharp(imageBuffer)
      .extract({ left, top, width: size, height: size })
      .resize(512, 512, { fit: 'cover' })
      .png()
      .toBuffer();
  } catch (error) {
    console.error('❌ Ошибка умной обрезки:', error);
    throw error;
  }
}

// 🎨 Создание стикера с эффектами
async function createSticker(imageBuffer, effect = 'none') {
  try {
    console.log(`🎨 Создаю стикер с эффектом: ${effect}`);
    
    // Умная обрезка
    const processedImage = await smartCrop(imageBuffer);
    
    // Применяем эффект
    const effectedImage = await applyEffect(processedImage, effect);
    
    // Оптимизируем размер
    const optimizedSticker = await optimizeStickerSize(effectedImage);
    
    console.log(`✅ Стикер создан! Эффект: ${effect}, Размер: ${optimizedSticker.length} байт`);
    return optimizedSticker;

  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error);
    
    // Fallback
    try {
      const simpleSticker = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      return await optimizeStickerSize(simpleSticker);
    } catch (fallbackError) {
      throw new Error('Не удалось обработать изображение');
    }
  }
}

module.exports = {
  downloadImage,
  createSticker,
  applyEffect,
  optimizeStickerSize
};
