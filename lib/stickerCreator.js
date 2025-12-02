// /lib/stickerCreator.js
const Jimp = require('jimp');

class StickerCreator {
  constructor() {
    console.log('✅ StickerCreator initialized with Jimp');
  }

  async downloadImage(url) {
    try {
      console.log(`📥 Downloading from: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('❌ Download failed:', error.message);
      throw error;
    }
  }

  async createSticker(imageBuffer, effect = 'none', options = {}) {
    try {
      console.log(`🎨 Processing sticker, effect: ${effect}`);
      
      // Загружаем изображение
      const image = await Jimp.read(imageBuffer);
      
      // Обрезаем до квадрата 512x512
      const size = 512;
      image.cover(size, size);
      
      // Применяем эффекты
      const effectName = effect.toLowerCase();
      
      switch(effectName) {
        case 'винтаж':
        case 'vintage':
          await this.applyVintageEffect(image);
          break;
        
        case 'черно-белый':
        case 'чб':
        case 'blackwhite':
          image.greyscale();
          break;
        
        case 'сепия':
        case 'sepia':
          image.sepia();
          break;
        
        case 'пикселизация':
        case 'pixelate':
          image.pixelate(16);
          break;
        
        case 'размытие':
        case 'blur':
          image.blur(5);
          break;
        
        case 'градиент':
        case 'gradient':
          await this.applyGradientEffect(image);
          break;
        
        case 'перламутр':
        case 'pearl':
          await this.applyPearlEffect(image);
          break;
        
        case 'текст':
        case 'text':
          await this.addText(image, options.text || 'Cool!');
          break;
        
        case 'золотая рамка':
        case 'gold frame':
          await this.addFrame(image, 'gold');
          break;
        
        case 'радужная рамка':
        case 'rainbow frame':
          await this.addFrame(image, 'rainbow');
          break;
        
        case 'инстаграм':
        case 'instagram':
          await this.applyInstagramFilter(image);
          break;
        
        default:
          // Без эффекта
          console.log('🎨 Creating sticker without effects');
      }
      
      // Конвертируем в PNG
      const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
      console.log(`✅ Sticker created: ${pngBuffer.length} bytes`);
      
      return pngBuffer;
      
    } catch (error) {
      console.error('❌ Error creating sticker:', error);
      // Fallback: возвращаем оригинальное изображение
      return imageBuffer;
    }
  }

  async applyVintageEffect(image) {
    // Винтажный эффект
    image.sepia();
    image.brightness(0.1);
    image.contrast(0.1);
    image.color([
      { apply: 'red', params: [10] },
      { apply: 'green', params: [-5] }
    ]);
  }

  async applyGradientEffect(image) {
    // Создаем градиентный оверлей
    const gradient = new Jimp(image.bitmap.width, image.bitmap.height, 0x00000000);
    
    for (let y = 0; y < gradient.bitmap.height; y++) {
      const alpha = Math.floor((y / gradient.bitmap.height) * 100);
      for (let x = 0; x < gradient.bitmap.width; x++) {
        // Розово-синий градиент
        const r = Math.floor(255 * (x / gradient.bitmap.width));
        const g = 105;
        const b = Math.floor(255 * (y / gradient.bitmap.height));
        gradient.setPixelColor(Jimp.rgbaToInt(r, g, b, alpha), x, y);
      }
    }
    
    image.composite(gradient, 0, 0, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 0.3
    });
  }

  async applyPearlEffect(image) {
    // Перламутровый эффект
    image.brightness(0.2);
    image.contrast(-0.1);
    image.color([
      { apply: 'hue', params: [180] },
      { apply: 'saturate', params: [20] }
    ]);
  }

  async addText(image, text) {
    try {
      // Загружаем шрифт
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
      
      // Рисуем текст
      const x = 20;
      const y = image.bitmap.height - 60;
      image.print(font, x, y, text);
      
      // Добавляем тень
      image.print(font, x + 2, y + 2, text, 0x00000080);
    } catch (error) {
      console.log('⚠️ Text effect skipped (font not available)');
    }
  }

  async addFrame(image, type) {
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const frameSize = 10;
    
    // Рисуем рамку
    for (let i = 0; i < frameSize; i++) {
      for (let x = 0; x < width; x++) {
        // Верхняя и нижняя границы
        let topColor, bottomColor;
        
        if (type === 'gold') {
          topColor = Jimp.rgbaToInt(255, 215, 0, 255); // Золотой
          bottomColor = Jimp.rgbaToInt(255, 215, 0, 255);
        } else if (type === 'rainbow') {
          // Радужная рамка
          const hue = (x / width) * 360;
          topColor = this.hslToRgb(hue / 360, 1, 0.5, 255);
          bottomColor = this.hslToRgb((x / width) * 360, 1, 0.5, 255);
        } else {
          topColor = Jimp.rgbaToInt(255, 0, 0, 255); // Красная по умолчанию
          bottomColor = Jimp.rgbaToInt(255, 0, 0, 255);
        }
        
        image.setPixelColor(topColor, x, i); // Верх
        image.setPixelColor(bottomColor, x, height - 1 - i); // Низ
      }
      
      for (let y = 0; y < height; y++) {
        // Левая и правая границы
        let leftColor, rightColor;
        
        if (type === 'gold') {
          leftColor = Jimp.rgbaToInt(255, 215, 0, 255);
          rightColor = Jimp.rgbaToInt(255, 215, 0, 255);
        } else if (type === 'rainbow') {
          const hue = (y / height) * 360;
          leftColor = this.hslToRgb(hue / 360, 1, 0.5, 255);
          rightColor = this.hslToRgb((y / height) * 360, 1, 0.5, 255);
        } else {
          leftColor = Jimp.rgbaToInt(255, 0, 0, 255);
          rightColor = Jimp.rgbaToInt(255, 0, 0, 255);
        }
        
        image.setPixelColor(leftColor, i, y); // Лево
        image.setPixelColor(rightColor, width - 1 - i, y); // Право
      }
    }
  }

  async applyInstagramFilter(image) {
    // Инстаграм-фильтр
    image.brightness(0.05);
    image.contrast(0.1);
    image.color([
      { apply: 'saturate', params: [10] },
      { apply: 'red', params: [5] },
      { apply: 'blue', params: [-5] }
    ]);
  }

  hslToRgb(h, s, l, a = 255) {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return Jimp.rgbaToInt(
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255),
      a
    );
  }

  async sendSticker(botToken, chatId, stickerBuffer) {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('chat_id', chatId);
      form.append('sticker', stickerBuffer, {
        filename: 'sticker.png',
        contentType: 'image/png'
      });

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendSticker`,
        {
          method: 'POST',
          body: form
        }
      );

      const result = await response.json();
      
      if (!result.ok) {
        console.error('❌ Telegram API error:', result);
        throw new Error(result.description || 'Failed to send sticker');
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error sending sticker:', error.message);
      
      // Fallback: отправляем как фото
      try {
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('chat_id', chatId);
        form.append('photo', stickerBuffer, {
          filename: 'sticker.png'
        });

        const photoResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/sendPhoto`,
          {
            method: 'POST',
            body: form
          }
        );
        
        return await photoResponse.json();
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError.message);
        throw error;
      }
    }
  }
}

module.exports = new StickerCreator();
