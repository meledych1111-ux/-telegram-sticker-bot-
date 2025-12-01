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
        const heart
