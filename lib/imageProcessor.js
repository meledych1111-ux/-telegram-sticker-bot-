// 🎨 ИСПРАВЛЕННАЯ ОБРАБОТКА ИЗОБРАЖЕНИЙ С ЭФФЕКТАМИ
const axios = require('axios');
const sharp = require('sharp');

// 📥 Скачивание изображения
async function downloadImage(url) {
  console.log('📥 Скачиваю изображение...');
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    console.log('✅ Изображение скачано');
    return Buffer.from(response.data);
  } catch (error) {
    console.error('❌ Ошибка скачивания изображения:', error.message);
    throw new Error('Не удалось скачать изображение');
  }
}

// 🎭 ПРИМЕНЕНИЕ ЭФФЕКТОВ (ИСПРАВЛЕННАЯ)
async function applyEffect(imageBuffer, effectName) {
  try {
    console.log(`🎭 Применяю эффект: ${effectName}`);
    
    if (effectName === 'none' || !effectName) {
      return imageBuffer;
    }
    
    let image = sharp(imageBuffer);
    
    switch (effectName.toLowerCase()) {
      case 'vintage':
        image = image
          .modulate({ brightness: 1.1, saturation: 0.8 })
          .tint({ r: 255, g: 240, b: 200 });
        break;
        
      case 'grayscale':
        image = image.grayscale();
        break;
        
      case 'sepia':
        image = image
          .modulate({ brightness: 1.1 })
          .tint({ r: 255, g: 240, b: 192 });
        break;
        
      case 'pixelate':
        const metadata = await sharp(imageBuffer).metadata();
        const pixelSize = 8;
        image = image
          .resize(
            Math.floor(metadata.width / pixelSize), 
            Math.floor(metadata.height / pixelSize)
          )
          .resize(metadata.width, metadata.height, { kernel: 'nearest' });
        break;
        
      case 'blur':
        image = image.blur(5);
        break;
        
      default:
        console.log(`⚠️ Неизвестный эффект: ${effectName}`);
        return imageBuffer;
    }
    
    const result = await image.png().toBuffer();
    console.log(`✅ Эффект ${effectName} применен`);
    return result;
    
  } catch (error) {
    console.error(`❌ Ошибка применения эффекта ${effectName}:`, error);
    return imageBuffer;
  }
}

// 🎯 УЛУЧШЕННАЯ ОБРЕЗКА
async function smartCrop(imageBuffer) {
  try {
    console.log('🎯 Умная обрезка изображения...');
    
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    console.log(`📏 Исходный размер: ${width}x${height}`);
    
    const targetSize = 512;
    
    // Если изображение уже квадратное
    if (width === height && width === targetSize) {
      return await sharp(imageBuffer).png().toBuffer();
    }
    
    // Обрезаем до квадрата по центру
    const size = Math.min(width, height);
    const left = Math.floor((width - size) / 2);
    const top = Math.floor((height - size) / 2);
    
    const cropped = await sharp(imageBuffer)
      .extract({ left, top, width: size, height: size })
      .resize(targetSize, targetSize)
      .png()
      .toBuffer();
    
    console.log('✅ Обрезка завершена');
    return cropped;
    
  } catch (error) {
    console.error('❌ Ошибка обрезки:', error);
    // Fallback - простая обрезка
    return await sharp(imageBuffer)
      .resize(512, 512, { 
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer();
  }
}

// 📦 ОПТИМИЗАЦИЯ РАЗМЕРА
async function optimizeStickerSize(stickerBuffer) {
  const maxSize = 512 * 1024;

  if (stickerBuffer.length <= maxSize) {
    return stickerBuffer;
  }

  console.log('📦 Оптимизирую размер...');
  
  let quality = 90;
  let optimizedBuffer = stickerBuffer;

  while (optimizedBuffer.length > maxSize && quality > 40) {
    optimizedBuffer = await sharp(stickerBuffer)
      .png({ quality: quality })
      .toBuffer();
    quality -= 10;
  }

  console.log(`✅ Оптимизировано до ${optimizedBuffer.length} байт`);
  return optimizedBuffer;
}

// 🎨 СОЗДАНИЕ СТИКЕРА С ЭФФЕКТАМИ
async function createSticker(imageBuffer, effect = 'none') {
  try {
    console.log(`🎨 Создаю стикер с эффектом: ${effect}`);
    
    // 1. Умная обрезка
    const croppedImage = await smartCrop(imageBuffer);
    
    // 2. Применяем эффект
    const effectedImage = await applyEffect(croppedImage, effect);
    
    // 3. Оптимизируем размер
    const optimizedSticker = await optimizeStickerSize(effectedImage);
    
    console.log(`✅ Стикер создан! Размер: ${optimizedSticker.length} байт`);
    return optimizedSticker;

  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error);
    throw error;
  }
}

module.exports = {
  downloadImage,
  createSticker,
  applyEffect
};
