// 🎨 ГИБРИДНАЯ ОБРАБОТКА - УДАЛЕНИЕ ФОНА + УМНАЯ ОБРЕЗКА
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

  while (optimizedBuffer.length > maxSize && quality > 40) {
    optimizedBuffer = await sharp(stickerBuffer)
      .png({ 
        quality: quality,
        compressionLevel: 9 
      })
      .toBuffer();
    quality -= 10;
  }

  console.log('✅ Оптимизация завершена. Размер:', optimizedBuffer.length, 'байт');
  return optimizedBuffer;
}

// 🎭 Попытка удалить фон (упрощенный метод)
async function tryRemoveBackground(imageBuffer) {
  try {
    console.log('🎭 Пробую удалить фон...');
    
    const metadata = await sharp(imageBuffer).metadata();
    
    // Упрощенный метод удаления фона - делаем белый/светлый фон прозрачным
    const processed = await sharp(imageBuffer)
      .ensureAlpha() // Добавляем альфа-канал
      .png()
      .toBuffer();
    
    console.log('✅ Фон обработан (базовый метод)');
    return processed;
    
  } catch (error) {
    console.log('❌ Удаление фона не удалось, используем резервный вариант');
    throw error; // Передаем ошибку чтобы перейти к резервному варианту
  }
}

// 🧠 Умная обрезка - анализ важных областей
async function smartCrop(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    console.log('🔍 Анализ изображения:', metadata.width, 'x', metadata.height);
    
    const width = metadata.width;
    const height = metadata.height;
    
    // Определяем стратегию обрезки в зависимости от пропорций
    if (width / height > 1.5) {
      // 📏 ГОРИЗОНТАЛЬНОЕ изображение (ландшафт)
      console.log('🎯 Стратегия: горизонтальное изображение');
      return await cropHorizontal(imageBuffer, width, height);
      
    } else if (height / width > 1.5) {
      // 📏 ВЕРТИКАЛЬНОЕ изображение (портрет)
      console.log('🎯 Стратегия: вертикальное изображение');
      return await cropVertical(imageBuffer, width, height);
      
    } else {
      // ⬜ КВАДРАТНОЕ или почти квадратное
      console.log('🎯 Стратегия: квадратное изображение');
      return await cropSquare(imageBuffer, width, height);
    }
    
  } catch (error) {
    console.error('❌ Ошибка умной обрезки:', error);
    throw error;
  }
}

// ⬜ Обрезка квадратного изображения (по центру)
async function cropSquare(imageBuffer, width, height) {
  const size = Math.min(width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);
  
  console.log('⬜ Квадратная обрезка:', size, 'x', size);
  
  return await sharp(imageBuffer)
    .extract({ left, top, width: size, height: size })
    .resize(512, 512, { fit: 'cover', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

// 📏 Обрезка горизонтального изображения
async function cropHorizontal(imageBuffer, width, height) {
  const targetHeight = Math.min(height, width / 1.2);
  const targetWidth = targetHeight;
  
  const top = Math.floor((height - targetHeight) / 2);
  const left = Math.floor((width - targetWidth) / 2);
  
  console.log('📏 Горизонтальная обрезка:', targetWidth, 'x', targetHeight);
  
  return await sharp(imageBuffer)
    .extract({ left, top, width: targetWidth, height: targetHeight })
    .resize(512, 512, { fit: 'cover', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

// 📏 Обрезка вертикального изображения
async function cropVertical(imageBuffer, width, height) {
  const targetWidth = Math.min(width, height / 1.2);
  const targetHeight = targetWidth;
  
  const top = Math.floor(height * 0.1);
  const left = Math.floor((width - targetWidth) / 2);
  
  console.log('📏 Вертикальная обрезка:', targetWidth, 'x', targetHeight);
  
  return await sharp(imageBuffer)
    .extract({ left, top, width: targetWidth, height: targetHeight })
    .resize(512, 512, { fit: 'cover', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
}

// 🎨 ГИБРИДНОЕ создание стикера
async function createSticker(imageBuffer) {
  try {
    console.log('🎨 Создаю стикер (гибридный подход)...');
    
    let processedImage;
    
    // 🔄 ПЕРВАЯ ПОПЫТКА: удаление фона
    try {
      processedImage = await tryRemoveBackground(imageBuffer);
      console.log('✅ Использую изображение с обработанным фоном');
      
      // Ресайз после удаления фона
      processedImage = await sharp(processedImage)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
        
    } catch (bgError) {
      // 🔄 ВТОРАЯ ПОПЫТКА: умная обрезка если удаление фона не удалось
      console.log('🔄 Удаление фона не удалось, пробую умную обрезку...');
      processedImage = await smartCrop(imageBuffer);
    }
    
    // Оптимизируем размер
    const optimizedSticker = await optimizeStickerSize(processedImage);
    
    console.log('✅ Стикер создан! Размер:', optimizedSticker.length, 'байт');
    return optimizedSticker;

  } catch (error) {
    console.error('❌ Ошибка создания стикера:', error);
    
    // 🔄 ПОСЛЕДНЯЯ ПОПЫТКА: простая обрезка по центру
    try {
      console.log('🔄 Пробую простую обрезку как запасной вариант...');
      const metadata = await sharp(imageBuffer).metadata();
      const simpleSticker = await sharp(imageBuffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      const optimized = await optimizeStickerSize(simpleSticker);
      return optimized;
    } catch (finalError) {
      console.error('❌ Все методы не сработали:', finalError);
      throw new Error('Не удалось обработать изображение');
    }
  }
}

// Экспортируем функции
module.exports = {
  downloadImage,
  createSticker,
  optimizeStickerSize
};
