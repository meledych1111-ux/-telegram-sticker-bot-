const sharp = require('sharp');
const axios = require('axios');

// Обработка изображения
async function processImage(imageUrl, options = {}) {
  const {
    addFrame = true,
    frameSize = 20,
    frameColor = 'white',
    addPearlEffect = false,
    addGradient = false,
    addText = null,
    textColor = 'white',
    backgroundColor = { r: 255, g: 255, b: 255, alpha: 0 },
    optimize = true,
    maxDimension = 512
  } = options;

  try {
    console.log('🖼️ Обработка изображения...');
    
    // Скачиваем изображение
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 20 * 1024 * 1024
    });
    
    let image = sharp(response.data);
    const metadata = await image.metadata();
    
    console.log(`📊 Исходные параметры: ${metadata.width}x${metadata.height}, ${metadata.format}`);
    
    // Автоматическая обрезка до квадрата
    const size = Math.min(metadata.width, metadata.height, maxDimension);
    
    if (metadata.width !== metadata.height) {
      const left = Math.floor((metadata.width - size) / 2);
      const top = Math.floor((metadata.height - size) / 2);
      
      image = image.extract({
        left: Math.max(0, left),
        top: Math.max(0, top),
        width: Math.min(size, metadata.width),
        height: Math.min(size, metadata.height)
      });
    }
    
    // Ресайз до нужного размера
    image = image.resize(size, size, {
      fit: 'cover',
      position: 'center',
      kernel: sharp.kernel.lanczos3,
      background: backgroundColor
    });
    
    // Добавляем рамку
    if (addFrame && frameSize > 0) {
      const finalSize = size + frameSize * 2;
      const frameBackground = getFrameColor(frameColor);
      
      image = image.extend({
        top: frameSize,
        bottom: frameSize,
        left: frameSize,
        right: frameSize,
        background: frameBackground
      });
      
      console.log(`🎨 Добавлена рамка: ${frameSize}px, цвет: ${frameColor}`);
    }
    
    // Перламутровый эффект
    if (addPearlEffect) {
      image = image
        .modulate({
          brightness: 1.1,
          saturation: 1.15,
          hue: 5
        })
        .blur(0.3)
        .sharpen({ sigma: 0.5 });
      
      console.log('✨ Применен перламутровый эффект');
    }
    
    // Градиентный эффект
    if (addGradient) {
      const gradient = await createGradientOverlay(
        size + (addFrame ? frameSize * 2 : 0)
      );
      image = image.composite([{ 
        input: gradient, 
        blend: 'overlay',
        opacity: 0.15 
      }]);
      
      console.log('🌈 Применен градиентный эффект');
    }
    
    // Добавление текста
    if (addText && addText.trim().length > 0) {
      const textOverlay = await createTextOverlay(
        addText.trim(), 
        size + (addFrame ? frameSize * 2 : 0),
        textColor
      );
      
      image = image.composite([{ 
        input: textOverlay,
        gravity: 'south',
        top: 10
      }]);
      
      console.log(`📝 Добавлен текст: "${addText}"`);
    }
    
    // Оптимизация для стикеров
    if (optimize) {
      image = image.png({
        quality: 90,
        compressionLevel: 9,
        palette: true,
        colors: 256,
        effort: 10
      });
    } else {
      image = image.png();
    }
    
    // Конвертируем в буфер
    const buffer = await image.toBuffer();
    
    const result = {
      buffer: buffer,
      width: size + (addFrame ? frameSize * 2 : 0),
      height: size + (addFrame ? frameSize * 2 : 0),
      format: 'png',
      size: buffer.length,
      optimized: optimize
    };
    
    console.log(`✅ Изображение обработано: ${result.width}x${result.height}, ${Math.round(result.size / 1024)}KB`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Ошибка обработки изображения:', error.message);
    
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Таймаут загрузки изображения');
    }
    
    throw new Error(`Ошибка обработки: ${error.message}`);
  }
}

// Создание градиентного оверлея
async function createGradientOverlay(size) {
  const gradientSvg = `
    <svg width="${size}" height="${size}">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(255,255,255);stop-opacity:0.1" />
          <stop offset="50%" style="stop-color:rgb(200,200,255);stop-opacity:0.05" />
          <stop offset="100%" style="stop-color:rgb(255,255,255);stop-opacity:0.1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad1)" />
    </svg>
  `;
  
  return sharp(Buffer.from(gradientSvg))
    .png()
    .toBuffer();
}

// Создание текстового оверлея
async function createTextOverlay(text, size, color = 'white') {
  const fontSize = Math.max(16, Math.min(32, Math.floor(size / 20)));
  const textColor = getTextColor(color);
  
  const textSvg = `
    <svg width="${size}" height="${size}">
      <style>
        .text {
          font-family: 'Arial', sans-serif;
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: ${textColor};
          text-anchor: middle;
          filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.7));
        }
      </style>
      <text x="50%" y="95%" class="text">${escapeHtml(text)}</text>
    </svg>
  `;
  
  return sharp(Buffer.from(textSvg))
    .png()
    .toBuffer();
}

// Получение цвета рамки
function getFrameColor(colorName) {
  const colors = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    green: { r: 0, g: 255, b: 0 },
    yellow: { r: 255, g: 255, b: 0 },
    purple: { r: 128, g: 0, b: 128 },
    pink: { r: 255, g: 192, b: 203 },
    orange: { r: 255, g: 165, b: 0 },
    gold: { r: 255, g: 215, b: 0 },
    silver: { r: 192, g: 192, b: 192 }
  };
  
  return colors[colorName.toLowerCase()] || colors.white;
}

// Получение цвета текста
function getTextColor(colorName) {
  const colors = {
    white: '#ffffff',
    black: '#000000',
    red: '#ff0000',
    blue: '#0000ff',
    green: '#00ff00',
    yellow: '#ffff00',
    purple: '#800080',
    pink: '#ffc0cb',
    orange: '#ffa500',
    gold: '#ffd700',
    silver: '#c0c0c0'
  };
  
  return colors[colorName.toLowerCase()] || colors.white;
}

// Экранирование HTML
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Создание набора стикеров
async function createStickerPack(bot, userId, name, title, stickers) {
  // Реализация создания набора стикеров через Telegram Bot API
  // В продакшене используйте bot.createNewStickerSet
  
  return {
    success: true,
    name: name,
    title: title,
    sticker_count: stickers.length,
    message: 'Функция создания стикерпаков будет добавлена в следующем обновлении'
  };
}

module.exports = {
  processImage,
  createStickerPack,
  getFrameColor,
  getTextColor
};
