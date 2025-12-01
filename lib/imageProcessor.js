const Jimp = require('jimp');

// Основная обработка изображения
async function processImage(imageUrl) {
  try {
    console.log('🖼️ Обработка изображения...');
    
    // Загружаем изображение
    const image = await Jimp.read(imageUrl);
    
    // Умная обрезка в квадрат
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    const x = Math.floor((image.bitmap.width - size) / 2);
    const y = Math.floor((image.bitmap.height - size) / 2);
    
    image.crop(x, y, size, size);
    
    // Масштабируем до 512x512 (стандарт Telegram стикеров)
    image.resize(512, 512);
    
    // Сохраняем качество
    image.quality(100);
    
    // Конвертируем в PNG buffer
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    
    console.log('✅ Изображение обработано: 512x512px');
    return buffer;
    
  } catch (error) {
    console.error('❌ Ошибка processImage:', error);
    throw error;
  }
}

// Добавить текст
async function addText(imageBuffer, text) {
  try {
    const image = await Jimp.read(imageBuffer);
    
    // Используем встроенный шрифт
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    
    // Размер текста
    const textWidth = Jimp.measureText(font, text);
    const textHeight = Jimp.measureTextHeight(font, text, 512);
    
    // Позиция (внизу по центру)
    const x = Math.floor((512 - textWidth) / 2);
    const y = 512 - textHeight - 20;
    
    // Добавляем полупрозрачный фон для текста
    for (let i = -10; i < textWidth + 10; i++) {
      for (let j = -5; j < textHeight + 5; j++) {
        const px = x + i;
        const py = y + j;
        
        if (px >= 0 && px < 512 && py >= 0 && py < 512) {
          const color = image.getPixelColor(px, py);
          const rgba = Jimp.intToRGBA(color);
          
          // Делаем фон темнее
          image.setPixelColor(
            Jimp.rgbaToInt(
              Math.max(0, rgba.r - 50),
              Math.max(0, rgba.g - 50),
              Math.max(0, rgba.b - 50),
              200
            ),
            px, py
          );
        }
      }
    }
    
    // Добавляем текст
    image.print(font, x, y, text);
    
    console.log(`✅ Текст добавлен: "${text}"`);
    return await image.getBufferAsync(Jimp.MIME_PNG);
    
  } catch (error) {
    console.error('❌ Ошибка addText:', error);
    return imageBuffer; // Возвращаем оригинал при ошибке
  }
}

// Добавить рамку
async function addFrame(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    
    const frameSize = 20;
    const frameColor = 0xFFFFFFFF; // Белый
    
    // Создаем новое изображение с рамкой
    const framed = new Jimp(512 + frameSize * 2, 512 + frameSize * 2, frameColor);
    
    // Вставляем оригинал в центр
    framed.composite(image, frameSize, frameSize);
    
    // Добавляем внутреннюю черную рамку (2px)
    for (let i = 0; i < 2; i++) {
      // Горизонтальные линии
      for (let x = frameSize; x < 512 + frameSize; x++) {
        framed.setPixelColor(0x000000FF, x, frameSize + i);
        framed.setPixelColor(0x000000FF, x, 512 + frameSize - i - 1);
      }
      // Вертикальные линии
      for (let y = frameSize; y < 512 + frameSize; y++) {
        framed.setPixelColor(0x000000FF, frameSize + i, y);
        framed.setPixelColor(0x000000FF, 512 + frameSize - i - 1, y);
      }
    }
    
    console.log('✅ Рамка добавлена');
    return await framed.getBufferAsync(Jimp.MIME_PNG);
    
  } catch (error) {
    console.error('❌ Ошибка addFrame:', error);
    return imageBuffer;
  }
}

// Перламутровый эффект
async function addPearlEffect(imageBuffer) {
  try {
    const image = await Jimp.read(imageBuffer);
    
    // Проходим по всем пикселям
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // Перламутровый эффект с градиентом
      const intensity = 30;
      const pearlR = Math.min(255, r + Math.sin(x * 0.01 + y * 0.01) * intensity);
      const pearlG = Math.min(255, g + Math.cos(x * 0.015) * intensity);
      const pearlB = Math.min(255, b + Math.sin(y * 0.02) * intensity);
      
      // Градиент от центра
      const centerX = 256;
      const centerY = 256;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const gradient = Math.sin(distance * 0.
