// /lib/stickerCreator.js
let canvas;

try {
  // Пробуем загрузить canvas
  canvas = require('canvas');
  console.log('✅ Canvas loaded successfully');
} catch (error) {
  console.log('⚠️ Canvas not available, using simple mode:', error.message);
  canvas = null;
}

class StickerCreator {
  constructor() {
    this.hasCanvas = canvas !== null;
  }

  async downloadImage(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async createSticker(imageBuffer, effect = 'none') {
    // Если canvas доступен, используем его
    if (this.hasCanvas) {
      return await this.createWithCanvas(imageBuffer, effect);
    }
    
    // Иначе используем простой режим
    console.log('🎨 Creating sticker (simple mode)');
    return {
      buffer: imageBuffer,
      message: effect === 'none' 
        ? '✅ Стикер готов!'
        : `✅ Стикер готов! (Эффект "${effect}" в полной версии)`
    };
  }

  async createWithCanvas(imageBuffer, effect) {
    try {
      const { createCanvas, loadImage } = canvas;
      const size = 512;
      const canvasObj = createCanvas(size, size);
      const ctx = canvasObj.getContext('2d');
      
      // Загружаем изображение
      const img = await loadImage(imageBuffer);
      
      // Рисуем с обрезкой
      const scale = Math.max(size / img.width, size / img.height);
      const x = (size - img.width * scale) / 2;
      const y = (size - img.height * scale) / 2;
      
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      
      // Применяем эффекты
      switch(effect.toLowerCase()) {
        case 'черно-белый':
        case 'чб':
          this.applyBlackWhite(ctx, size);
          break;
        case 'сепия':
          this.applySepia(ctx, size);
          break;
      }
      
      return canvasObj.toBuffer('image/png');
    } catch (error) {
      console.error('Canvas error:', error);
      return imageBuffer;
    }
  }

  applyBlackWhite(ctx, size) {
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = data[i + 1] = data[i + 2] = avg;
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  applySepia(ctx, size) {
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
      data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
      data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  async sendSticker(botToken, chatId, stickerData) {
    try {
      // Если это буфер, отправляем как стикер
      if (Buffer.isBuffer(stickerData)) {
        return await this.sendBufferAsSticker(botToken, chatId, stickerData);
      }
      
      // Если это объект с буфером и сообщением
      if (stickerData.buffer && Buffer.isBuffer(stickerData.buffer)) {
        const result = await this.sendBufferAsSticker(botToken, chatId, stickerData.buffer);
        
        // Отправляем сообщение об эффекте если нужно
        if (stickerData.message && !stickerData.message.includes('✅ Стикер готов!')) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: stickerData.message,
              parse_mode: 'Markdown'
            })
          });
        }
        
        return result;
      }
      
      throw new Error('Invalid sticker data');
      
    } catch (error) {
      console.error('❌ Error sending sticker:', error);
      throw error;
    }
  }

  async sendBufferAsSticker(botToken, chatId, buffer) {
    // Создаем FormData вручную
    const boundary = '----WebKitFormBoundary' + Date.now();
    const chunks = [];
    
    // Добавляем chat_id
    chunks.push(`--${boundary}\r\n`);
    chunks.push('Content-Disposition: form-data; name="chat_id"\r\n\r\n');
    chunks.push(`${chatId}\r\n`);
    
    // Добавляем стикер
    chunks.push(`--${boundary}\r\n`);
    chunks.push('Content-Disposition: form-data; name="sticker"; filename="sticker.png"\r\n');
    chunks.push('Content-Type: image/png\r\n\r\n');
    chunks.push(buffer);
    chunks.push(`\r\n--${boundary}--\r\n`);
    
    // Объединяем
    const bodyBuffer = Buffer.concat(chunks.map(chunk => 
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    ));
    
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendSticker`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length.toString()
        },
        body: bodyBuffer
      }
    );
    
    return await response.json();
  }
}

module.exports = new StickerCreator();
