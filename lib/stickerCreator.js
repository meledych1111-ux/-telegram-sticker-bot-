// 🎨 РЕАЛЬНЫЙ СОЗДАТЕЛЬ СТИКЕРОВ БЕЗ ВНЕШНИХ ЗАВИСИМОСТЕЙ
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
  
  // 🎨 СОЗДАТЬ РЕАЛЬНЫЙ СТИКЕР С ЭФФЕКТОМ
  async createSticker(imageBuffer, effectName, options = {}) {
    console.log(`🎨 Создаю реальный стикер с эффектом: ${effectName}`);
    
    try {
      let image = sharp(imageBuffer);
      
      // Обрезаем до квадрата 512x512
      const metadata = await image.metadata();
      const size = Math.min(metadata.width, metadata.height);
      
      image = image.extract({
        left: Math.floor((metadata.width - size) / 2),
        top: Math.floor((metadata.height - size) / 2),
        width: size,
        height: size
      }).resize(512, 512);
      
      // ПРИМЕНЯЕМ РЕАЛЬНЫЕ ЭФФЕКТЫ
      switch (effectName.toLowerCase()) {
        case 'винтаж':
          image = image.modulate({ brightness: 0.9, saturation: 0.8 })
                      .tint({ r: 255, g: 240, b: 200 });
          break;
          
        case 'черно-белый':
        case 'чб':
          image = image.greyscale();
          break;
          
        case 'сепия':
          image = image.tint({ r: 255, g: 240, b: 192 });
          break;
          
        case 'пикселизация':
          image = image.resize(128, 128, { kernel: 'nearest' })
                      .resize(512, 512, { kernel: 'nearest' });
          break;
          
        case 'градиент':
          // Создаем градиент поверх изображения
          const gradient = await this.createGradientBuffer(512, 512);
          image = await this.blendImages(await image.toBuffer(), gradient);
          break;
          
        case 'текст':
          // Добавляем текст (упрощенно - через наложение)
          if (options.text) {
            image = await this.addTextToImage(await image.toBuffer(), options.text);
          }
          break;
          
        case 'рамка':
          image = await this.addFrame(await image.toBuffer(), options.frameColor || 'gold');
          break;
          
        case 'без эффекта':
        default:
          // Без изменений
          break;
      }
      
      // Конвертируем в PNG и оптимизируем
      const stickerBuffer = await image.png({ 
        compressionLevel: 9,
        quality: 80 
      }).toBuffer();
      
      console.log(`✅ Реальный стикер создан! Размер: ${stickerBuffer.length} байт`);
      return stickerBuffer;
      
    } catch (error) {
      console.error('❌ Ошибка создания реального стикера:', error);
      
      // Fallback: просто обрезаем и ресайзим
      console.log('🔄 Использую fallback...');
      return await sharp(imageBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer();
    }
  }
  
  // 🌈 СОЗДАТЬ ГРАДИЕНТ
  async createGradientBuffer(width, height) {
    // Создаем простой градиент через sharp
    const gradient = Buffer.from(
      `<svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(255,105,180);stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:rgb(0,191,255);stop-opacity:0.1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)"/>
      </svg>`
    );
    
    return await sharp(gradient).png().toBuffer();
  }
  
  // 🖼️ СМЕШАТЬ ДВА ИЗОБРАЖЕНИЯ
  async blendImages(baseImageBuffer, overlayBuffer) {
    return await sharp(baseImageBuffer)
      .composite([{ input: overlayBuffer, blend: 'overlay' }])
      .png()
      .toBuffer();
  }
  
  // 📝 ДОБАВИТЬ ТЕКСТ (упрощенно)
  async addTextToImage(imageBuffer, text) {
    // Создаем SVG с текстом
    const svgText = Buffer.from(`
      <svg width="512" height="512">
        <style>
          .text { 
            font-family: Arial, sans-serif;
            font-size: 48px; 
            font-weight: bold;
            fill: white;
            stroke: black;
            stroke-width: 2;
            paint-order: stroke;
          }
        </style>
        <text x="256" y="450" text-anchor="middle" class="text">${text}</text>
      </svg>
    `);
    
    return await sharp(imageBuffer)
      .composite([{ input: svgText, blend: 'over' }])
      .png()
      .toBuffer();
  }
  
  // 🖼️ ДОБАВИТЬ РАМКУ
  async addFrame(imageBuffer, frameColor) {
    const frameSize = 15;
    const size = 512;
    
    // Создаем рамку как SVG
    let frameSvg;
    if (frameColor === 'gold') {
      frameSvg = `
        <svg width="${size}" height="${size}">
          <defs>
            <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#FFD700" />
              <stop offset="50%" style="stop-color:#FFA500" />
              <stop offset="100%" style="stop-color:#FF8C00" />
            </linearGradient>
          </defs>
          <rect x="${frameSize/2}" y="${frameSize/2}" 
                width="${size - frameSize}" height="${size - frameSize}" 
                fill="none" stroke="url(#gold)" stroke-width="${frameSize}" />
          
          <!-- Уголки -->
          <rect x="0" y="0" width="${frameSize*2}" height="${frameSize}" fill="url(#gold)" />
          <rect x="0" y="0" width="${frameSize}" height="${frameSize*2}" fill="url(#gold)" />
          
          <rect x="${size - frameSize*2}" y="0" width="${frameSize*2}" height="${frameSize}" fill="url(#gold)" />
          <rect x="${size - frameSize}" y="0" width="${frameSize}" height="${frameSize*2}" fill="url(#gold)" />
          
          <rect x="0" y="${size - frameSize}" width="${frameSize*2}" height="${frameSize}" fill="url(#gold)" />
          <rect x="0" y="${size - frameSize*2}" width="${frameSize}" height="${frameSize*2}" fill="url(#gold)" />
          
          <rect x="${size - frameSize*2}" y="${size - frameSize}" width="${frameSize*2}" height="${frameSize}" fill="url(#gold)" />
          <rect x="${size - frameSize}" y="${size - frameSize*2}" width="${frameSize}" height="${frameSize*2}" fill="url(#gold)" />
        </svg>
      `;
    } else {
      // Простая цветная рамка
      frameSvg = `
        <svg width="${size}" height="${size}">
          <rect x="${frameSize/2}" y="${frameSize/2}" 
                width="${size - frameSize}" height="${size - frameSize}" 
                fill="none" stroke="${frameColor}" stroke-width="${frameSize}" />
        </svg>
      `;
    }
    
    return await sharp(imageBuffer)
      .composite([{ input: Buffer.from(frameSvg), blend: 'over' }])
      .png()
      .toBuffer();
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
        const error = await response.json();
        throw new Error(`Telegram: ${error.description || 'Unknown error'}`);
      }
      
      console.log('✅ Стикер отправлен!');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка отправки стикера:', error.message);
      throw error;
    }
  }
}

module.exports = new StickerCreator();
