// 🎨 РЕАЛЬНЫЙ СОЗДАТЕЛЬ СТИКЕРОВ ТОЛЬКО С SHARP
const sharp = require('sharp');

class StickerCreator {
  
  // 📥 Скачать изображение
  async downloadImage(url) {
    console.log('📥 Скачиваю изображение...');
    try {
      const response = await fetch(url, { timeout: 30000 });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`✅ Изображение скачано: ${buffer.length} байт`);
      return buffer;
    } catch (error) {
      console.error('❌ Ошибка скачивания:', error.message);
      throw error;
    }
  }
  
  // 🎨 СОЗДАТЬ РЕАЛЬНЫЙ СТИКЕР
  async createSticker(imageBuffer, effectName, options = {}) {
    console.log(`🎨 Создаю стикер с эффектом: ${effectName}`);
    
    try {
      let image = sharp(imageBuffer);
      
      // Получаем метаданные для обрезки
      const metadata = await image.metadata();
      const size = Math.min(metadata.width, metadata.height);
      
      // Обрезаем до квадрата
      if (metadata.width !== metadata.height) {
        image = image.extract({
          left: Math.floor((metadata.width - size) / 2),
          top: Math.floor((metadata.height - size) / 2),
          width: size,
          height: size
        });
      }
      
      // Ресайз до 512x512
      image = image.resize(512, 512, {
        fit: 'cover',
        position: 'center'
      });
      
      // ПРИМЕНЯЕМ ЭФФЕКТЫ
      await this.applyEffect(image, effectName, options);
      
      // Конвертируем в PNG с оптимизацией
      const stickerBuffer = await image.png({
        compressionLevel: 9,
        quality: 85,
        palette: true
      }).toBuffer();
      
      // Проверяем размер (максимум 512KB для Telegram)
      if (stickerBuffer.length > 512 * 1024) {
        console.log('📦 Оптимизирую размер...');
        return await this.optimizeSize(stickerBuffer);
      }
      
      console.log(`✅ Стикер создан! Размер: ${stickerBuffer.length} байт`);
      return stickerBuffer;
      
    } catch (error) {
      console.error('❌ Ошибка создания стикера:', error);
      throw error;
    }
  }
  
  // 🎭 ПРИМЕНИТЬ ЭФФЕКТ
  async applyEffect(image, effectName, options) {
    effectName = effectName.toLowerCase();
    
    switch (effectName) {
      case 'винтаж':
        image.modulate({ brightness: 0.9, saturation: 0.8 })
             .tint({ r: 255, g: 240, b: 200 });
        break;
        
      case 'черно-белый':
      case 'чб':
        image.greyscale();
        break;
        
      case 'сепия':
        image.tint({ r: 255, g: 240, b: 192 });
        break;
        
      case 'пикселизация':
        // Уменьшаем и увеличиваем обратно для пикселизации
        const pixelSize = 8;
        image.resize(
          Math.floor(512 / pixelSize),
          Math.floor(512 / pixelSize),
          { kernel: 'nearest' }
        ).resize(512, 512, { kernel: 'nearest' });
        break;
        
      case 'размытие':
        image.blur(5);
        break;
        
      case 'градиент':
        // Создаем градиентный оверлей
        const gradient = await this.createGradientOverlay();
        image.composite([{
          input: gradient,
          blend: 'overlay',
          gravity: 'center'
        }]);
        break;
        
      case 'перламутр':
        // Эффект перламутра через несколько операций
        image.modulate({ brightness: 1.1, saturation: 1.2 })
             .sharpen({ sigma: 0.5, m1: 1, m2: 2 });
        break;
        
      case 'инстаграм':
        // Инстаграм-фильтр
        image.modulate({ brightness: 1.1, saturation: 1.15 })
             .gamma(1.1);
        break;
        
      case 'рамка':
        const frameBuffer = await this.createFrame(options.frameColor || 'gold');
        image.composite([{
          input: frameBuffer,
          blend: 'over',
          gravity: 'center'
        }]);
        break;
        
      case 'текст':
        if (options.text) {
          const textBuffer = await this.createTextOverlay(options.text);
          image.composite([{
            input: textBuffer,
            blend: 'over',
            gravity: 'south'
          }]);
        }
        break;
        
      // 'без эффекта' - ничего не делаем
    }
  }
  
  // 🌈 СОЗДАТЬ ГРАДИЕНТНЫЙ ОВЕРЛЕЙ
  async createGradientOverlay() {
    // Создаем SVG градиент
    const svg = Buffer.from(`
      <svg width="512" height="512">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="rgba(255,105,180,0.4)" />
            <stop offset="50%" stop-color="rgba(0,191,255,0.2)" />
            <stop offset="100%" stop-color="rgba(138,43,226,0.3)" />
          </linearGradient>
          <radialGradient id="radial" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.1)" />
            <stop offset="100%" stop-color="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <circle cx="256" cy="256" r="200" fill="url(#radial)" />
      </svg>
    `);
    
    return await sharp(svg).png().toBuffer();
  }
  
  // 🖼️ СОЗДАТЬ РАМКУ
  async createFrame(frameColor) {
    const colors = {
      gold: { r: 255, g: 215, b: 0 },
      silver: { r: 192, g: 192, b: 192 },
      rainbow: 'none' // специальный случай
    };
    
    let svg;
    if (frameColor === 'rainbow') {
      svg = `
        <svg width="512" height="512">
          <defs>
            <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FF0000" />
              <stop offset="20%" stop-color="#FFA500" />
              <stop offset="40%" stop-color="#FFFF00" />
              <stop offset="60%" stop-color="#00FF00" />
              <stop offset="80%" stop-color="#0000FF" />
              <stop offset="100%" stop-color="#800080" />
            </linearGradient>
          </defs>
          <rect x="10" y="10" width="492" height="492" 
                fill="none" stroke="url(#rainbow)" stroke-width="20" 
                rx="20" ry="20" />
          <!-- Уголки -->
          <rect x="0" y="0" width="40" height="20" fill="url(#rainbow)" />
          <rect x="0" y="0" width="20" height="40" fill="url(#rainbow)" />
          
          <rect x="472" y="0" width="40" height="20" fill="url(#rainbow)" />
          <rect x="492" y="0" width="20" height="40" fill="url(#rainbow)" />
          
          <rect x="0" y="492" width="40" height="20" fill="url(#rainbow)" />
          <rect x="0" y="472" width="20" height="40" fill="url(#rainbow)" />
          
          <rect x="472" y="492" width="40" height="20" fill="url(#rainbow)" />
          <rect x="492" y="472" width="20" height="40" fill="url(#rainbow)" />
        </svg>
      `;
    } else {
      const color = colors[frameColor] || { r: 255, g: 215, b: 0 };
      svg = `
        <svg width="512" height="512">
          <rect x="15" y="15" width="482" height="482" 
                fill="none" stroke="rgb(${color.r},${color.g},${color.b})" 
                stroke-width="30" rx="15" ry="15" />
        </svg>
      `;
    }
    
    return await sharp(Buffer.from(svg)).png().toBuffer();
  }
  
  // 📝 СОЗДАТЬ ТЕКСТОВЫЙ ОВЕРЛЕЙ
  async createTextOverlay(text) {
    const svg = Buffer.from(`
      <svg width="512" height="512">
        <style>
          .text {
            font-family: Arial, sans-serif;
            font-size: 48px;
            font-weight: bold;
            fill: white;
            stroke: black;
            stroke-width: 3;
            paint-order: stroke;
          }
        </style>
        <text x="256" y="450" text-anchor="middle" class="text">${text}</text>
      </svg>
    `);
    
    return await sharp(svg).png().toBuffer();
  }
  
  // 📦 ОПТИМИЗИРОВАТЬ РАЗМЕР
  async optimizeSize(buffer) {
    let quality = 80;
    let optimizedBuffer = buffer;
    
    while (optimizedBuffer.length > 512 * 1024 && quality > 40) {
      optimizedBuffer = await sharp(buffer)
        .png({ quality: quality, compressionLevel: 9 })
        .toBuffer();
      quality -= 10;
    }
    
    console.log(`📦 Оптимизировано до: ${optimizedBuffer.length} байт (quality: ${quality})`);
    return optimizedBuffer;
  }
  
  // 📤 ОТПРАВИТЬ СТИКЕР В TELEGRAM
  async sendSticker(botToken, chatId, stickerBuffer) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('chat_id', chatId);
      form.append('sticker', stickerBuffer, {
        filename: 'sticker.png',
        contentType: 'image/png'
      });
      
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendSticker`, {
        method: 'POST',
        headers: form.getHeaders(),
        body: form
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API: ${error}`);
      }
      
      console.log('✅ Стикер отправлен в Telegram!');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка отправки стикера:', error.message);
      throw error;
    }
  }
}

module.exports = new StickerCreator();
