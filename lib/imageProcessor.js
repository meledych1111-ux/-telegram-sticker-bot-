const Jimp = require('jimp');

// Цвета для рамок
const COLORS = {
  white: 0xFFFFFFFF,
  black: 0x000000FF,
  red: 0xFF0000FF,
  blue: 0x0000FFFF,
  green: 0x00FF00FF,
  yellow: 0xFFFF00FF,
  purple: 0x800080FF,
  orange: 0xFFA500FF,
  pink: 0xFFC0CBFF,
  gold: 0xFFD700FF,
  silver: 0xC0C0C0FF
};

// Основная обработка
async function processImage(imageUrl) {
  try {
    console.log('🖼️ Обработка изображения...');
    const image = await Jimp.read(imageUrl);
    
    // Умная обрезка в квадрат
    const size = Math.min(image.bitmap.width, image.bitmap.height);
    const x = Math.floor((image.bitmap.width - size) / 2);
    const y = Math.floor((image.bitmap.height - size) / 2);
    
    image.crop(x, y, size, size);
    image.resize(512, 512);
    image.quality(100);
    
    console.log('✅ Изображение обработано');
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    console.error('❌ Ошибка processImage:', error);
    throw error;
  }
}

// Добавить текст
async function addText(imageBuffer, text) {
  try {
    const image = await Jimp.read(imageBuffer);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    
    const textWidth = Jimp.measureText(font, text);
    const textHeight = Jimp.measureTextHeight(font, text, 512);
    const x = Math.floor((512 - textWidth) / 2);
    const y = 512 - textHeight - 20;
    
    // Фон для текста
    for (let i = -10; i < textWidth + 10; i++) {
      for (let j = -5; j < textHeight + 5; j++) {
        const px = x + i;
        const py = y + j;
        if (px >= 0 && px < 512 && py >= 0 && py < 512) {
          const color = image.getPixelColor(px, py);
          const rgba = Jimp.intToRGBA(color);
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
    
    image.print(font, x, y, text);
    console.log(`✅ Текст добавлен: "${text}"`);
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    console.error('❌ Ошибка addText:', error);
    return imageBuffer;
  }
}

// Добавить рамку с цветом
async function addFrame(imageBuffer, colorName = 'white') {
  try {
    const image = await Jimp.read(imageBuffer);
    const frameSize = 20;
    const frameColor = COLORS[colorName] || COLORS.white;
    const innerFrameColor = 0x000000FF; // Черная внутренняя рамка
    
    // Создаем новое изображение с рамкой
    const framed = new Jimp(512 + frameSize * 2, 512 + frameSize * 2, frameColor);
    framed.composite(image, frameSize, frameSize);
    
    // Внутренняя рамка (2px)
    for (let i = 0; i < 2; i++) {
      for (let x = frameSize; x < 512 + frameSize; x++) {
        framed.setPixelColor(innerFrameColor, x, frameSize + i);
        framed.setPixelColor(innerFrameColor, x, 512 + frameSize - i - 1);
      }
      for (let y = frameSize; y < 512 + frameSize; y++) {
        framed.setPixelColor(innerFrameColor, frameSize + i, y);
        framed.setPixelColor(innerFrameColor, 512 + frameSize - i - 1, y);
      }
    }
    
    console.log(`✅ Рамка добавлена (цвет: ${colorName})`);
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
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      const intensity = 30;
      const pearlR = Math.min(255, r + Math.sin(x * 0.01 + y * 0.01) * intensity);
      const pearlG = Math.min(255, g + Math.cos(x * 0.015) * intensity);
      const pearlB = Math.min(255, b + Math.sin(y * 0.02) * intensity);
      
      const centerX = 256;
      const centerY = 256;
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const gradient = Math.sin(distance * 0.02) * 20;
      
      this.bitmap.data[idx + 0] = Math.min(255, pearlR + gradient);
      this.bitmap.data[idx + 1] = Math.min(255, pearlG + gradient);
      this.bitmap.data[idx + 2] = Math.min(255, pearlB + gradient);
      
      this.bitmap.data[idx + 0] = Math.min(255, this.bitmap.data[idx + 0] *  1.1);
      this.bitmap.data[idx + 1] = Math.min(255, this1.1);
      this.bitmap.data[idx + 1].bitmap.data[idx + 1] * = Math.min(255, this.bitmap.data[idx + 1] * 1.1 1.1);
      this.bitmap.data[idx + 2] = Math.min(255, this.bitmap.data[idx + 2] * 1.1);
    });
    
    image.blur(1);
);
      this.bitmap.data[idx + 2] = Math.min(255, this.bitmap.data[idx + 2] * 1.1);
    });
    
    image.blur(1);
    console.log('✅ Перла    console.log('✅ Перламутровыймутровый эффект добавлен');
    return await эффект добавлен');
    return await image.getBufferAsync(J image.getBufferAsync(Jimp.MIME_PNGimp.MIME_PNG);
 );
  } catch (error } catch (error) {
) {
    console.error('    console.error('❌❌ Ошиб Ошибка addPearlка addPearlEffect:', error);
   Effect:', error);
    return imageBuffer return imageBuffer;
  }
;
  }
}

// Гра}

// Градиентный эффекдиентный эффект
т
async function addGasync function addGradientEffectradientEffect(imageBuffer) {
(imageBuffer) {
  try  try {
    const image {
    const image = await = await Jimp.read(imageBuffer);
    
    image.scan( Jimp.read(imageBuffer);
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bit0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx +map.data[idx + 0 0];
      const g];
      const g = this = this.bit.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // Градиент от верхнего левого к нижнему правому
      const gradient = (x + y) / (512 + 512) * 100;
      
      this.bitmap.data[idx + 0] = Math.min(255, r + gradient * 0.5);
      this.map.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // Градиент от верхнего левого к нижнему правому
      const gradient = (x + y) / (512 + 512) * 100;
      
      this.bitmap.data[idx + 0] = Math.min(255, r + gradient * 0.5);
      this.bitmap.data[idx + 1] = Math.min(255, g + gradient * 0.8);
      this.bitmap.data[idx + 2] = Math.min(255, b + gradientbitmap.data[idx + 1] = Math.min(255, g + gradient * 0.8);
      this.bitmap.data[idx + 2] = Math.min(255, b + gradient * 1.2);
    });
    
 * 1.2);
    });
    
    console.log('✅ Градиент    console.log('✅ Градиентный эффект добавлен');
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (error) {
    console.error('❌ Ошибка addGradientEffect:', error);
    return imageBuffer;
  }
}

module.exports = {
  processImage,
  addText,
  addFrame,
  addPearlEffect,
  addGradientEffect
};
