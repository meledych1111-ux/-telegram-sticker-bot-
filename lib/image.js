const sharp = require('sharp');
const axios = require('axios');

// Кэш для быстрой работы
const cache = new Map();

class FastImageProcessor {
  constructor() {
    this.maxSize = 512; // Оптимально для стикеров
  }
  
  async downloadImage(url) {
    const cacheKey = `download_${url}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 3000
    });
    
    const buffer = Buffer.from(response.data);
    cache.set(cacheKey, buffer);
    setTimeout(() => cache.delete(cacheKey), 30000);
    
    return buffer;
  }
  
  async createSticker(imageBuffer, options = {}) {
    try {
      let image = sharp(imageBuffer)
        .resize(this.maxSize, this.maxSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      
      // Применяем эффект (быстрые операции)
      if (options.effect) {
        image = await this.applyEffect(image, options.effect);
      }
      
      // Добавляем рамку
      if (options.frame) {
        image = await this.addFrame(image, options.frame);
      }
      
      // Добавляем текст через SVG (быстро)
      if (options.text) {
        image = await this.addText(image, options.text);
      }
      
      // Конвертируем в PNG для стикера
      return await image.png().toBuffer();
    } catch (error) {
      console.error('Image processing error:', error);
      throw error;
    }
  }
  
  async applyEffect(image, effect) {
    switch(effect) {
      case 'grayscale':
        return image.grayscale();
        
      case 'sepia':
        return image.recomb([
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131]
        ]);
        
      case 'invert':
        return image.negate();
        
      case 'blur':
        return image.blur(3); // Легкое размытие
        
      case 'pixelate':
        const metadata = await image.metadata();
        return image
          .resize(Math.floor(metadata.width / 8), Math.floor(metadata.height / 8))
          .resize(metadata.width, metadata.height, { kernel: 'nearest' });
        
      case 'vintage':
        return image
          .modulate({ brightness: 0.9, saturation: 0.8 })
          .tint({ r: 255, g: 240, b: 220 });
        
      case 'neon':
        return image
          .linear(1.2, -50)
          .recomb([
            [0.1, 1.0, 0.1],
            [0.1, 0.1, 1.0],
            [1.0, 0.1, 0.1]
          ]);
        
      case 'gradient':
        const { width, height } = await image.metadata();
        const gradient = Buffer.from(`
          <svg width="${width}" height="${height}">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:rgb(255,0,255);stop-opacity:0.3" />
                <stop offset="100%" style="stop-color:rgb(0,255,255);stop-opacity:0.3" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad)" />
          </svg>
        `);
        return image.composite([{ input: gradient, blend: 'overlay' }]);
        
      case 'pearl':
        return image
          .modulate({ saturation: 1.3 })
          .linear(0.8, 50)
          .sharpen({ sigma: 1, flat: 1, jagged: 2 });
        
      default:
        return image;
    }
  }
  
  async addFrame(image, frame) {
    const metadata = await image.metadata();
    
    switch(frame) {
      case 'rounded':
        const rounded = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <rect x="0" y="0" width="100%" height="100%" 
                  rx="${metadata.width * 0.1}" ry="${metadata.height * 0.1}"
                  fill="white"/>
          </svg>
        `);
        return image.composite([{ input: rounded, blend: 'dest-in' }]);
        
      case 'circle':
        const size = Math.min(metadata.width, metadata.height);
        const circle = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <circle cx="${metadata.width/2}" cy="${metadata.height/2}" 
                    r="${size/2}" fill="white"/>
          </svg>
        `);
        return image.composite([{ input: circle, blend: 'dest-in' }]);
        
      case 'heart':
        const heart = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <path d="M ${metadata.width/2} ${metadata.height/4}
                    C ${metadata.width*0.7} ${metadata.height/10} 
                      ${metadata.width*0.9} ${metadata.height/10} 
                      ${metadata.width*0.9} ${metadata.height/3}
                    C ${metadata.width*0.9} ${metadata.height/2} 
                      ${metadata.width/2} ${metadata.height*0.7} 
                      ${metadata.width*0.1} ${metadata.height/3}
                    C ${metadata.width*0.1} ${metadata.height/10} 
                      ${metadata.width*0.3} ${metadata.height/10} 
                      ${metadata.width/2} ${metadata.height/4}
                    Z" fill="white"/>
          </svg>
        `);
        return image.composite([{ input: heart, blend: 'dest-in' }]);
        
      case 'star':
        const starSize = Math.min(metadata.width, metadata.height) * 0.8;
        let starPath = `M ${metadata.width/2} ${metadata.height/2 - starSize/2}`;
        for (let i = 1; i <= 5; i++) {
          const angleOuter = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const angleInner = angleOuter + Math.PI / 5;
          
          starPath += ` L ${metadata.width/2 + Math.cos(angleOuter) * starSize/2} 
                         ${metadata.height/2 + Math.sin(angleOuter) * starSize/2}`;
          starPath += ` L ${metadata.width/2 + Math.cos(angleInner) * starSize/4} 
                         ${metadata.height/2 + Math.sin(angleInner) * starSize/4}`;
        }
        starPath += ' Z';
        
        const star = Buffer.from(`
          <svg width="${metadata.width}" height="${metadata.height}">
            <path d="${starPath}" fill="white"/>
          </svg>
        `);
        return image.composite([{ input: star, blend: 'dest-in' }]);
        
      default:
        return image;
    }
  }
  
  async addText(image, text) {
    const metadata = await image.metadata();
    const fontSize = Math.min(metadata.width, metadata.height) * 0.08;
    
    const svgText = Buffer.from(`
      <svg width="${metadata.width}" height="${metadata.height}">
        <style>
          .sticker-text {
            fill: white;
            stroke: black;
            stroke-width: 3;
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            font-weight: bold;
            text-anchor: middle;
            paint-order: stroke fill;
          }
        </style>
        <text x="50%" y="90%" class="sticker-text">${text}</text>
      </svg>
    `);
    
    return image.composite([{ input: svgText, blend: 'over' }]);
  }
  
  // Быстрая миниатюра для предпросмотра
  async createPreview(imageBuffer, effect) {
    return sharp(imageBuffer)
      .resize(200, 200, { fit: 'cover' })
      .png()
      .toBuffer();
  }
}

module.exports = new FastImageProcessor();
