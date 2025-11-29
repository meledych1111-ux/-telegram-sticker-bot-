// 🎨 УЛУЧШЕННАЯ ОБРАБОТКА ИЗОБРАЖЕНИЙ С УМНОЙ ОБРЕЗКОЙ
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

// 🎯 УМНАЯ ОБРЕЗКА ДЛЯ СТИКЕРОВ
async function smartCrop(imageBuffer) {
  try {
    console.log('🎯 Умная обрезка изображения...');
    
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const { width, height } = metadata;
    
    console.log(`📏 Исходный размер: ${width}x${height}`);
    
    // Определяем целевой размер для стикера
    const targetSize = 512;
    
    // Если изображение уже квадратное и нужного размера
    if (width === height && width === targetSize) {
      console.log('✅ Изображение уже идеального размера');
      return await image.png().toBuffer();
    }
    
    // Вычисляем коэффициенты для разных стратегий обрезки
    const ratio = width / height;
    
    let processedImage;
    
    if (Math.abs(ratio - 1) < 0.1) {
      // Почти квадратное изображение - просто масштабируем
      console.log('🔷 Почти квадратное изображение - масштабируем');
      processedImage = await image
        .resize(targetSize, targetSize, { fit: 'cover' })
        .png()
        .toBuffer();
    } else if (ratio > 1.5) {
      // Широкое изображение - обрезаем по центру
      console.log('🟦 Широкое изображение - обрезаем по центру');
      const cropHeight = height;
      const cropWidth = height; // Делаем квадрат
      const left = Math.floor((width - cropWidth) / 2);
      
      processedImage = await image
        .extract({ left, top: 0, width: cropWidth, height: cropHeight })
        .resize(targetSize, targetSize)
        .png()
        .toBuffer();
    } else if (ratio < 0.67) {
      // Высокое изображение - обрезаем по центру
      console.log('🟥 Высокое изображение - обрезаем по центру');
      const cropWidth = width;
      const cropHeight = width; // Делаем квадрат
      const top = Math.floor((height - cropHeight) / 2);
      
      processedImage = await image
        .extract({ left: 0, top, width: cropWidth, height: cropHeight })
        .resize(targetSize, targetSize)
        .png()
        .toBuffer();
    } else {
      // Умеренное соотношение - используем умное покрытие
      console.log('🔶 Умеренное соотношение - умное покрытие');
      processedImage = await image
        .resize(targetSize, targetSize, { 
          fit: 'cover',
          position: 'center'
        })
        .png()
        .toBuffer();
    }
    
    console.log('✅ Умная обрезка завершена');
    return processedImage;
    
  } catch (error) {
    console.error('❌ Ошибка умной обрезки:', error);
    // Fallback - простая обрезка
    console.log('🔄 Использую простую обрезку...');
    return await sharp(imageBuffer)
      .resize(512, 512, { 
        fit: 'cover',
        position: 'center'
      })
      .png()
      .toBuffer();
  }
}

// 🎭 УЛУЧШЕННОЕ ПРИМЕНЕНИЕ ЭФФЕКТОВ
async function applyEffect(imageBuffer, effectName) {
  try {
    if (effectName === 'none') {
      return imageBuffer;
    }
    
    console.log(`🎭 Применяю эффект: ${effectName}`);
    
    let image = sharp(imageBuffer);
    
    switch (effectName.toLowerCase()) {
      case 'vintage':
        image = image
          .modulate({ brightness: 1.05, saturation: 0.85 })
          .tint({ r: 255, g: 240, b: 200 })
          .sharpen(0.5);
        break;
        
      case 'grayscale':
        image = image
          .grayscale()
          .modulate({ brightness: 1.1 });
        break;
        
      case 'sepia':
        image = image
          .modulate({ brightness: 1.1 })
          .tint({ r: 255, g: 240, b: 192 })
          .sharpen(0.3);
        break;
        
      case 'pixelate':
        const metadata = await sharp(imageBuffer).metadata();
        const pixelSize = Math.max(4, Math.floor(Math.min(metadata.width, metadata.height) / 64));
        image = image
          .resize(
            Math.floor(metadata.width / pixelSize), 
            Math.floor(metadata.height / pixelSize)
          )
          .resize(metadata.width, metadata.height, { kernel: 'nearest' });
        break;
        
      case 'blur':
        image = image.blur(2.5);
        break;
        
      default:
        console.log(`⚠️ Неизвестный эффект: ${effectName}, пропускаю`);
        return imageBuffer;
    }
    
    const result = await image.png().toBuffer();
    console.log(`✅ Эффект ${effectName} применен`);
    return result;
    
  } catch (error) {
    console.error(`❌ Ошибка применения эффекта ${effectName}:`, error);
    return imageBuffer; // Возвращаем оригинал при ошибке
  }
}

// 📦 ОПТИМИЗАЦИЯ РАЗМЕРА СТИКЕРА
async function optimizeStickerSize(stickerBuffer) {
  const maxSize = 512 * 1024; // 512KB лимит Telegram

  if (stickerBuffer.length <= maxSize) {
    console.log(`✅ Размер стикера: ${stickerBuffer.length} байт (в пределах лимита)`);
    return stickerBuffer;
  }

  console.log(`📦 Оптимизирую размер: ${stickerBuffer.length} байт → ${maxSize} байт`);
  
  let quality = 90;
  let optimizedBuffer = stickerBuffer;

  try {
    // Постепенно уменьшаем качество пока не впишемся в лимит
    while (optimizedBuffer.length > maxSize && quality > 40) {
      optimizedBuffer = await sharp(stickerBuffer)
        .png({ 
          quality: quality,
          compressionLevel: 9,
          effort: 10
        })
        .toBuffer();
      
      console.log(`   Попытка quality ${quality}: ${optimizedBuffer.length} байт`);
      quality -= 10;
    }

    if (optimizedBuffer.length > maxSize) {
      // Если все еще большой, пробуем уменьшить размер
      console.log('🔄 Пробую уменьшить разрешение...');
      optimizedBuffer = await sharp(stickerBuffer)
        .resize(480, 480)
        .png({ quality: 70, compressionLevel: 9 })
        .toBuffer();
    }

    console.log(`✅ Оптимизировано до ${optimizedBuffer.length} байт`);
    return optimizedBuffer;
    
  } catch (error) {
    console.error('❌ Ошибка оптимизации размера:', error);
    return stickerBuffer; // Возвращаем оригинал при ошибке
  }
}

// 🎨 СОЗДАНИЕ СТИКЕРА С ЭФФЕКТАМИ
async function createSticker(imageBuffer, effect = 'none') {
  try {
    console.log(`🎨 Создаю стикер${effect !== 'none' ? ` с эффектом "${effect}"` : ''}...`);
    
    // 1. Умная обрезка до 512x512
    const croppedImage = await smartCrop(imageBuffer);
    
    // 2. Применяем эффект если указан
    const effectedImage = effect !== 'none' 
      ? await applyEffect(croppedImage, effect)
      : croppedImage;
    
    // 3. Оптимизируем размер для Telegram
    const optimizedSticker = await optimizeStickerSize(effectedImage);
    
    console.log(`✅ Стикер создан! Размер: ${optimizedSticker.length} байт`);
    return optimizedSticker;

  } catch (error) {
    console.error('❌ Критическая ошибка создания стикера:', error);
    
    // Fallback - максимально простой стикер
    try {
      console.log('🔄 Пробую создать простой стикер...');
      const simpleSticker = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      return await optimizeStickerSize(simpleSticker);
    } catch (fallbackError) {
      console.error('❌ Не удалось создать даже простой стикер:', fallbackError);
      throw new Error('Не удалось обработать изображение');
    }
  }
}

module.exports = {
  downloadImage,
  createSticker,
  applyEffect,
  optimizeStickerSize,
  smartCrop
};
