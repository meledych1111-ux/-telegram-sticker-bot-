const sharp = require('sharp');
const axios = require('axios');
const cache = require('./cache');
const config = require('../config/constants');

class ImageProcessor {
  constructor() {
    this.stickerSize = config.IMAGE_SIZES.STICKER;
    this.previewSize = config.IMAGE_SIZES.PREVIEW;
    this.maxFileSize = config.IMAGE_SIZES.MAX_FILE_SIZE;
  }
  
  // Загрузка изображения с кэшированием
  async downloadImage(url) {
    const cacheKey = `image_download:${Buffer.from(url).toString('base64')}`;
    
    return cache.memoize(cacheKey, async () => {
      try {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'arraybuffer',
          timeout: 5000,
          maxContentLength: this.maxFileSize
        });
        
        return Buffer.from(response.data);
      } catch (error) {
        console.error('Error downloading image:', error.message);
        throw new Error(`Failed to download image: ${error.message}`);
      }
    }, 300); // Кэш на 5 минут
  }
  
  // Основная функция создания стикера
  async createSticker(imageBuffer, options = {}) {
    const startTime = Date.now();
    
    try {
      let pipeline = sharp(imageBuffer)
        .resize(this.stickerSize, this.stickerSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .ensureAlpha();
      
      // Применяем эффект
      if (options.effect && options.effect !== config.EFFECTS.NONE) {
        pipeline = await this.applyEffect(pipeline, options.effect);
      }
      
      // Добавляем рамку
      if (options.frame && options.frame !== config.FRAMES.NONE) {
        pipeline = await this.addFrame(pipeline, options.frame);
      }
      
      // Добавляем текст
      if (options.text && options.text.trim().length > 0) {
        pipeline = await this.addText(pipeline, options.text, options.textPosition);
      }
      
      // Конвертируем в PNG и получаем буфер
      const result = await pipeline.png().toBuffer();
      
      const processingTime = Date.now() - startTime;
      console.log(`Sticker created in ${processingTime}ms, size: ${result.length} bytes`);
      
      return result;
    } catch (error) {
      console.error('Error creating sticker:', error);
      throw error;
    }
  }
  
  // Создание превью (быстрее)
  async createPreview(imageBuffer, effect = config.EFFECTS.NONE) {
    try {
      let pipeline = sharp(imageBuffer)
        .resize(this.previewSize, this.previewSize, {
          fit: 'cover'
        });
      
      if (effect && effect !== config.EFFECTS.NONE) {
        pipeline = await this.applyEffect(pipeline, effect);
      }
      
      return await pipeline.jpeg({ quality: 80 }).toBuffer();
    } catch (error) {
      console.error('Error creating preview:', error);
      throw error;
    }
  }
  
  // Применение эффектов
  async applyEffect(pipeline, effect) {
    const metadata = await pipeline.metadata();
    
    switch(effect) {
      case config.EFFECTS.GRAYSCALE:
        return pipeline.grayscale();
        
      case config.EFFECTS.SEPIA:
        return pipeline.recomb([
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131]
        ]);
        
      case config.EFFECTS.INVERT:
        return pipeline.negate();
        
      case config.EFFECTS.BLUR:
        return pipeline.blur(3);
        
      case config.EFFECTS.SHARPEN:
        return pipeline.sharpen({ sigma: 1, m1: 1, m2: 2 });
        
      case config.EFFECTS.PIXELATE:
        return pipeline
          .resize(Math.floor(metadata.width / 8), Math.floor(metadata.height / 8))
          .resize(metadata.width, metadata.height, { kernel: 'nearest' });
        
      case config.EFFECTS.VINTAGE:
        return pipeline
          .modulate({ brightness: 0.9, saturation: 0.8 })
          .tint({ r: 255, g: 240, b: 220 });
        
      case config.EFFECTS.NEON:
        return pipeline
          .linear(1.3, -30)
          .recomb([
            [0.1, 0.9, 0.0],
            [0.0, 0.1, 0.9],
            [0.9, 0.0, 0.1]
          ]);
        
      case config.EFFECTS.GRADIENT:
        const gradient = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:rgb(255,105,180);stop-opacity:0.4" />
                <stop offset="50%" style="stop-color:rgb(0,191,255);stop-opacity:0.4" />
                <stop offset="100%" style="stop-color:rgb(50,205,50);stop-opacity:0.4" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad1)" />
          </svg>
        `);
        return pipeline.composite([{ input: gradient, blend: 'overlay' }]);
        
      case config.EFFECTS.PEARL:
        return pipeline
          .modulate({ saturation: 1.4, brightness: 1.1 })
          .linear(0.9, 20)
          .sharpen({ sigma: 0.8, m1: 0.5, m2: 1 });
        
      case config.EFFECTS.GLOW:
        const glow = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <rect width="100%" height="100%" filter="url(#glow)" fill="white" opacity="0.3"/>
          </svg>
        `);
        return pipeline.composite([{ input: glow, blend: 'overlay' }]);
        
      case config.EFFECTS.SKETCH:
        return pipeline
          .greyscale()
          .linear(3, -150)
          .negate()
          .blur(1)
          .negate();
        
      default:
        return pipeline;
    }
  }
  
  // Добавление рамки
  async addFrame(pipeline, frame) {
    const metadata = await pipeline.metadata();
    
    switch(frame) {
      case config.FRAMES.CIRCLE:
        const circle = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <circle cx="${metadata.width/2}" cy="${metadata.height/2}" 
                    r="${Math.min(metadata.width, metadata.height)/2}" 
                    fill="white"/>
          </svg>
        `);
        return pipeline.composite([{ input: circle, blend: 'dest-in' }]);
        
      case config.FRAMES.HEART:
        const heart = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <path d="M ${metadata.width/2} ${metadata.height/4}
                    C ${metadata.width*0.7} ${metadata.height*0.1} 
                      ${metadata.width*0.9} ${metadata.height*0.1} 
                      ${metadata.width*0.9} ${metadata.height*0.3}
                    C ${metadata.width*0.9} ${metadata.height*0.5} 
                      ${metadata.width/2} ${metadata.height*0.7} 
                      ${metadata.width*0.1} ${metadata.height*0.3}
                    C ${metadata.width*0.1} ${metadata.height*0.1} 
                      ${metadata.width*0.3} ${metadata.height*0.1} 
                      ${metadata.width/2} ${metadata.height/4}
                    Z" fill="white"/>
          </svg>
        `);
        return pipeline.composite([{ input: heart, blend: 'dest-in' }]);
        
      case config.FRAMES.STAR:
        const points = 5;
        const outerRadius = Math.min(metadata.width, metadata.height) * 0.45;
        const innerRadius = outerRadius * 0.5;
        
        let starPath = `M ${metadata.width/2} ${metadata.height/2 - outerRadius}`;
        
        for (let i = 0; i < points; i++) {
          const angleOuter = (Math.PI * 2 * i) / points - Math.PI / 2;
          const angleInner = angleOuter + Math.PI / points;
          
          starPath += ` L ${metadata.width/2 + Math.cos(angleOuter) * outerRadius} 
                         ${metadata.height/2 + Math.sin(angleOuter) * outerRadius}`;
          starPath += ` L ${metadata.width/2 + Math.cos(angleInner) * innerRadius} 
                         ${metadata.height/2 + Math.sin(angleInner) * innerRadius}`;
        }
        starPath += ' Z';
        
        const star = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <path d="${starPath}" fill="white"/>
          </svg>
        `);
        return pipeline.composite([{ input: star, blend: 'dest-in' }]);
        
      case config.FRAMES.ROUNDED:
        const rounded = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <rect x="0" y="0" width="100%" height="100%" 
                  rx="${metadata.width * 0.15}" ry="${metadata.height * 0.15}"
                  fill="white"/>
          </svg>
        `);
        return pipeline.composite([{ input: rounded, blend: 'dest-in' }]);
        
      case config.FRAMES.DIAMOND:
        const diamond = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <polygon points="${metadata.width/2},0 ${metadata.width},${metadata.height/2} ${metadata.width/2},${metadata.height} 0,${metadata.height/2}" 
                     fill="white"/>
          </svg>
        `);
        return pipeline.composite([{ input: diamond, blend: 'dest-in' }]);
        
      case config.FRAMES.HEXAGON:
        const hexagon = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <polygon points="${metadata.width*0.25},0 ${metadata.width*0.75},0 ${metadata.width},${metadata.height/2} ${metadata.width*0.75},${metadata.height} ${metadata.width*0.25},${metadata.height} 0,${metadata.height/2}" 
                     fill="white"/>
          </svg>
        `);
        return pipeline.composite([{ input: hexagon, blend: 'dest-in' }]);
        
      case config.FRAMES.CLOUD:
        const cloud = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <path d="M ${metadata.width*0.2} ${metadata.height*0.5}
                    A ${metadata.width*0.15} ${metadata.height*0.15} 0 1 1 ${metadata.width*0.8} ${metadata.height*0.5}
                    A ${metadata.width*0.15} ${metadata.height*0.15} 0 1 1 ${metadata.width*0.2} ${metadata.height*0.5}
                    Z" fill="white"/>
          </svg>
        `);
        return pipeline.composite([{ input: cloud, blend: 'dest-in' }]);
        
      default:
        return pipeline;
    }
  }
  
  // Добавление текста
  async addText(pipeline, text, position = config.TEXT_POSITIONS.BOTTOM) {
    const metadata = await pipeline.metadata();
    const fontSize = Math.min(metadata.width, metadata.height) * 0.08;
    
    let y;
    switch(position) {
      case config.TEXT_POSITIONS.TOP:
        y = fontSize + 10;
        break;
      case config.TEXT_POSITIONS.CENTER:
        y = metadata.height / 2;
        break;
      case config.TEXT_POSITIONS.BOTTOM:
      default:
        y = metadata.height - 20;
    }
    
    const svgText = Buffer.from(`
      <svg width="${metadata.width}" height="${metadata.height}">
        <style>
          .sticker-text {
            fill: white;
            stroke: black;
            stroke-width: 4;
            stroke-linejoin: round;
            paint-order: stroke fill;
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            font-weight: bold;
            text-anchor: middle;
            filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.5));
          }
        </style>
        <text x="${metadata.width/2}" y="${y}" class="sticker-text">
          ${this.escapeXml(text)}
        </text>
      </svg>
    `);
    
    return pipeline.composite([{ input: svgText, blend: 'over' }]);
  }
  
  // Экранирование XML
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  // Проверка поддерживаемого формата
  isSupportedFormat(mimeType) {
    const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    return supported.includes(mimeType);
  }
}

module.exports = new ImageProcessor();
