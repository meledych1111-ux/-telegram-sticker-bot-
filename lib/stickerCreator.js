// 🎨 РЕАЛЬНОЕ СОЗДАНИЕ СТИКЕРОВ С КРУТЫМИ ЭФФЕКТАМИ
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

class StickerCreator {
  constructor() {
    // Регистрируем шрифты (если есть)
    try {
      registerFont(path.join(__dirname, 'fonts', 'Arial.ttf'), { family: 'Arial' });
      registerFont(path.join(__dirname, 'fonts', 'Comic.ttf'), { family: 'Comic Sans' });
    } catch (error) {
      console.log('⚠️ Используются стандартные шрифты');
    }
  }
  
  // 📥 Скачать изображение
  async downloadImage(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  // 🎨 СОЗДАТЬ СТИКЕР С ЭФФЕКТОМ
  async createSticker(imageBuffer, effectName, options = {}) {
    try {
      console.log(`🎨 Создаю стикер с эффектом: ${effectName}`);
      
      // Загружаем изображение
      const img = await loadImage(imageBuffer);
      
      // Создаем canvas 512x512
      const canvas = createCanvas(512, 512);
      const ctx = canvas.getContext('2d');
      
      // Обрезаем до квадрата
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      
      // Рисуем обрезанное изображение
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
      
      // ПРИМЕНЯЕМ ЭФФЕКТЫ
      if (effectName !== 'без эффекта') {
        const imageData = ctx.getImageData(0, 0, 512, 512);
        const data = imageData.data;
        
        switch (effectName.toLowerCase()) {
          case 'винтаж':
            this.applyVintageEffect(data);
            break;
          case 'черно-белый':
          case 'чб':
            this.applyGrayscaleEffect(data);
            break;
          case 'сепия':
            this.applySepiaEffect(data);
            break;
          case 'пикселизация':
            this.applyPixelateEffect(ctx);
            break;
          case 'градиент':
            this.applyGradientEffect(ctx, options.gradientColor);
            break;
          case 'перламутр':
            this.applyPearlescentEffect(data);
            break;
          case 'текст':
            this.addTextEffect(ctx, options.text || 'Cool!');
            break;
          case 'рамка':
            this.addFrameEffect(ctx, options.frameColor || 'gold');
            break;
          case 'инстаграм':
            this.applyInstagramFilter(data);
            break;
        }
        
        ctx.putImageData(imageData, 0, 0);
      }
      
      // Оптимизируем размер
      const stickerBuffer = await this.optimizeSize(canvas);
      
      console.log(`✅ Стикер создан! Размер: ${stickerBuffer.length} байт`);
      return stickerBuffer;
      
    } catch (error) {
      console.error('❌ Ошибка создания стикера:', error);
      throw error;
    }
  }
  
  // 📦 ОПТИМИЗАЦИЯ РАЗМЕРА
  async optimizeSize(canvas) {
    let quality = 100;
    let buffer = canvas.toBuffer('image/png', { compressionLevel: 9 });
    
    // Если больше 500KB, уменьшаем качество
    while (buffer.length > 500 * 1024 && quality > 50) {
      quality -= 10;
      buffer = canvas.toBuffer('image/png', { 
        compressionLevel: 9,
        quality: quality / 100 
      });
    }
    
    return buffer;
  }
  
  // 🎭 ЭФФЕКТ ВИНТАЖ
  applyVintageEffect(data) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      data[i] = Math.min(255, r * 0.9 + 40);
      data[i + 1] = Math.min(255, g * 0.8 + 30);
      data[i + 2] = Math.min(255, b * 0.6 + 20);
    }
  }
  
  // ⚫⚪ ЧЕРНО-БЕЛЫЙ
  applyGrayscaleEffect(data) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const avg = (r + g + b) / 3;
      
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }
  }
  
  // 🟤 СЕПИЯ
  applySepiaEffect(data) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
      data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
      data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
    }
  }
  
  // 🎮 ПИКСЕЛИЗАЦИЯ
  applyPixelateEffect(ctx) {
    const size = 16;
    const width = 512;
    const height = 512;
    
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        const imageData = ctx.getImageData(x, y, size, size);
        const data = imageData.data;
        
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        
        const count = data.length / 4;
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, size, size);
      }
    }
  }
  
  // 🌈 ГРАДИЕНТНЫЙ ЭФФЕКТ
  applyGradientEffect(ctx, gradientColor = 'rgba(255,105,180,0.3)') {
    // Создаем градиент
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, gradientColor);
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = 'source-over';
  }
  
  // ✨ ПЕРЛАМУТРОВЫЙ ЭФФЕКТ
  applyPearlescentEffect(data) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Добавляем перламутровое сияние
      const pearlescent = (r + g + b) / 3;
      
      data[i] = Math.min(255, r * 0.7 + pearlescent * 0.3 + 20);
      data[i + 1] = Math.min(255, g * 0.7 + pearlescent * 0.3 + 20);
      data[i + 2] = Math.min(255, b * 0.7 + pearlescent * 0.3 + 30);
      
      // Добавляем легкое мерцание
      if (Math.random() > 0.9) {
        data[i] += 30;
        data[i + 1] += 30;
      }
    }
  }
  
  // 📝 ДОБАВЛЕНИЕ ТЕКСТА
  addTextEffect(ctx, text = 'Cool!') {
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Тень текста
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, 257, 462);
    
    // Основной текст с градиентом
    const gradient = ctx.createLinearGradient(0, 430, 0, 490);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FFA500');
    gradient.addColorStop(1, '#FF4500');
    
    ctx.fillStyle = gradient;
    ctx.fillText(text, 256, 460);
    
    // Обводка текста
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'white';
    ctx.strokeText(text, 256, 460);
  }
  
  // 🖼️ РАМКА ВОКРУГ СТИКЕРА
  addFrameEffect(ctx, frameColor = 'gold') {
    const frameWidth = 15;
    
    // Градиент для рамки
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    
    if (frameColor === 'gold') {
      gradient.addColorStop(0, '#FFD700');
      gradient.addColorStop(0.5, '#FFA500');
      gradient.addColorStop(1, '#FF8C00');
    } else if (frameColor === 'silver') {
      gradient.addColorStop(0, '#C0C0C0');
      gradient.addColorStop(0.5, '#A9A9A9');
      gradient.addColorStop(1, '#808080');
    } else if (frameColor === 'rainbow') {
      gradient.addColorStop(0, '#FF0000');
      gradient.addColorStop(0.2, '#FFA500');
      gradient.addColorStop(0.4, '#FFFF00');
      gradient.addColorStop(0.6, '#00FF00');
      gradient.addColorStop(0.8, '#0000FF');
      gradient.addColorStop(1, '#800080');
    } else {
      gradient.addColorStop(0, frameColor);
      gradient.addColorStop(1, frameColor);
    }
    
    // Рисуем рамку
    ctx.strokeStyle = gradient;
    ctx.lineWidth = frameWidth;
    ctx.strokeRect(
      frameWidth / 2, 
      frameWidth / 2, 
      512 - frameWidth, 
      512 - frameWidth
    );
    
    // Добавляем уголки
    this.drawCorners(ctx, frameWidth, gradient);
  }
  
  // 🔶 РИСУЕМ УГОЛКИ РАМКИ
  drawCorners(ctx, frameWidth, gradient) {
    const cornerSize = 25;
    
    ctx.fillStyle = gradient;
    
    // Левый верхний
    ctx.fillRect(0, 0, cornerSize, frameWidth);
    ctx.fillRect(0, 0, frameWidth, cornerSize);
    
    // Правый верхний
    ctx.fillRect(512 - cornerSize, 0, cornerSize, frameWidth);
    ctx.fillRect(512 - frameWidth, 0, frameWidth, cornerSize);
    
    // Левый нижний
    ctx.fillRect(0, 512 - frameWidth, cornerSize, frameWidth);
    ctx.fillRect(0, 512 - cornerSize, frameWidth, cornerSize);
    
    // Правый нижний
    ctx.fillRect(512 - cornerSize, 512 - frameWidth, cornerSize, frameWidth);
    ctx.fillRect(512 - frameWidth, 512 - cornerSize, frameWidth, cornerSize);
  }
  
  // 📸 ИНСТАГРАМ ФИЛЬТР
  applyInstagramFilter(data) {
    for (let i = 0; i < data.length; i += 4) {
      // Повышаем контрастность и насыщенность
      data[i] = Math.min(255, data[i] * 1.1);
      data[i + 1] = Math.min(255, data[i + 1] * 1.05);
      data[i + 2] = Math.min(255, data[i + 2] * 0.95);
      
      // Добавляем теплый оттенок
      data[i] += 10;
      data[i + 1] += 5;
    }
  }
  
  // 🎨 МИКС ЭФФЕКТОВ
  async createMixedEffect(imageBuffer, effects = []) {
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    
    const img = await loadImage(imageBuffer);
    const size = Math.min(img.width, img.height);
    const sx = (img.width - size) / 2;
    const sy = (img.height - size) / 2;
    
    ctx.drawImage(img, sx, sy, size, size, 0, 0, 512, 512);
    
    effects.forEach(effect => {
      const imageData = ctx.getImageData(0, 0, 512, 512);
      const data = imageData.data;
      
      if (effect === 'винтаж') this.applyVintageEffect(data);
      if (effect === 'чб') this.applyGrayscaleEffect(data);
      if (effect === 'перламутр') this.applyPearlescentEffect(data);
      
      ctx.putImageData(imageData, 0, 0);
    });
    
    return canvas.toBuffer('image/png');
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
      
      await fetch(`https://api.telegram.org/bot${botToken}/sendSticker`, {
        method: 'POST',
        headers: form.getHeaders(),
        body: form
      });
      
      console.log('✅ Стикер отправлен!');
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка отправки стикера:', error.message);
      throw error;
    }
  }
}

module.exports = new StickerCreator();
