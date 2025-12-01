import sharp from 'sharp';
import { info, error } from './logger.js';

// Конфигурация
const STICKER_SIZE = 512;

/**
 * Обработка изображения для стикера
 */
export async function processImage(imageBuffer, options = {}) {
  try {
    const startTime = Date.now();
    
    const {
      effect = 'none',
      frame = 'rounded',
      text = '',
      backgroundColor = 'transparent'
    } = options;
    
    let image = sharp(imageBuffer);
    
    // Получаем метаданные
    const metadata = await image.metadata();
    info(`📐 Размер исходного изображения: ${metadata.width}x${metadata.height}, формат: ${metadata.format}`);
    
    // 1. Изменение размера и обрезка до квадрата
    image = image.resize({
      width: STICKER_SIZE,
      height: STICKER_SIZE,
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true
    });
    
    // 2. Добавление рамки
    if (frame !== 'none') {
      image = await addFrame(image, frame);
    }
    
    // 3. Применение эффекта
    if (effect !== 'none') {
      image = await applyEffect(image, effect);
    }
    
    // 4. Конвертация в WebP (формат стикеров)
    const processedBuffer = await image
      .webp({ quality: 90 })
      .toBuffer();
    
    const processingTime = Date.now() - startTime;
    info(`✅ Изображение обработано за ${processingTime}ms`);
    
    return processedBuffer;
  } catch (err) {
    error(`❌ Ошибка обработки изображения: ${err.message}`);
    throw err;
  }
}

/**
 * Добавление рамки к изображению
 */
async function addFrame(image, frameType) {
  switch (frameType) {
    case 'rounded':
      // Закругленные углы
      const roundedCorners = Buffer.from(
        `<svg width="512" height="512">
          <rect x="0" y="0" width="512" height="512" rx="100" ry="100" fill="white"/>
        </svg>`
      );
      
      return image
        .composite([{
          input: roundedCorners,
          blend: 'dest-in'
        }]);
    
    case 'circle':
      // Круглая обрезка
      const circleMask = Buffer.from(
        `<svg width="512" height="512">
          <circle cx="256" cy="256" r="256" fill="white"/>
        </svg>`
      );
      
      return image
        .composite([{
          input: circleMask,
          blend: 'dest-in'
        }]);
    
    case 'border':
      // Простая рамка
      return image
        .extend({
          top: 20,
          bottom: 20,
          left: 20,
          right: 20,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        });
    
    default:
      return image;
  }
}

/**
 * Применение эффектов к изображению
 */
async function applyEffect(image, effectType) {
  switch (effectType) {
    case 'grayscale':
      return image.grayscale();
    
    case 'sepia':
      return image
        .recomb([
          [0.393, 0.769, 0.189],
          [0.349, 0.686, 0.168],
          [0.272, 0.534, 0.131]
        ]);
    
    case 'vibrant':
      return image.modulate({
        brightness: 1.1,
        saturation: 1.3
      });
    
    case 'blur':
      return image.blur(10);
    
    case 'pixelate':
      return image.resize(128, 128, { fit: 'fill' })
        .resize(512, 512, { kernel: 'nearest' });
    
    default:
      return image;
  }
}

/**
 * Проверка изображения
 */
export async function validateImage(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Проверка формата
    const allowedFormats = ['jpeg', 'png', 'webp', 'gif'];
    if (!allowedFormats.includes(metadata.format)) {
      throw new Error(`Неподдерживаемый формат: ${metadata.format}`);
    }
    
    // Проверка размера
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (imageBuffer.length > maxSize) {
      throw new Error(`Размер файла превышает 20MB: ${Math.round(imageBuffer.length / 1024 / 1024)}MB`);
    }
    
    return {
      valid: true,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      size: imageBuffer.length
    };
  } catch (err) {
    error(`❌ Ошибка валидации изображения: ${err.message}`);
    throw err;
  }
}

/**
 * Создание превью изображения
 */
export async function createThumbnail(imageBuffer, size = 100) {
  return sharp(imageBuffer)
    .resize(size, size, { fit: 'cover' })
    .jpeg({ quality: 70 })
    .toBuffer();
}

// Именованный экспорт для обратной совместимости
export default {
  processImage,
  validateImage,
  createThumbnail
};
