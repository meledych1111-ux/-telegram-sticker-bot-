const sharp = require('sharp');

// Обработка изображения
async function processImage(buffer, options = {}) {
  const {
    addFrame = true,
    frameSize = 20,
    frameColor = 'white',
    addPearlEffect = false,
    addGradient = false
  } = options;

  try {
    let image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Обрезаем до квадрата
    const size = Math.min(metadata.width, metadata.height, 512);
    
    if (metadata.width !== metadata.height) {
      const left = Math.floor((metadata.width - size) / 2);
      const top = Math.floor((metadata.height - size) / 2);
      
      image = image.extract({
        left: Math.max(0, left),
        top: Math.max(0, top),
        width: size,
        height: size
      });
    }
    
    // Ресайз
    image = image.resize(size, size);
    
    // Добавляем рамку
    if (addFrame && frameSize > 0) {
      const finalSize = size + frameSize * 2;
      const backgroundColor = getFrameColor(frameColor);
      
      image = image.extend({
        top: frameSize,
        bottom: frameSize,
        left: frameSize,
        right: frameSize,
        background: backgroundColor
      });
    }
    
    // Перламутровый эффект
    if (addPearlEffect) {
      image = image
        .modulate({
          brightness: 1.1,
          saturation: 1.15
        })
        .blur(0.5);
    }
    
    // Конвертируем в PNG
    const processedBuffer = await image.png().toBuffer();
    
    return {
      buffer: processedBuffer,
      width: size + (addFrame ? frameSize * 2 : 0),
      height: size + (addFrame ? frameSize * 2 : 0),
      format: 'png',
      size: processedBuffer.length
    };
    
  } catch (error) {
    console.error('❌ Ошибка обработки изображения:', error);
    throw error;
  }
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

module.exports = {
  processImage,
  getFrameColor
};
