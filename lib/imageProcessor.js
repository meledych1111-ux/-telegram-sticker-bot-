// 🎨  lib/imageProcessor.js – полностью исправленная обработка изображений
const axios = require('axios');
const sharp = require('sharp');

const MAX_INPUT_SIZE  = 10 * 1024 * 1024; // 10 MB
const STICKER_SIZE    = 512;              // Telegram max
const MAX_OUTPUT_SIZE = 512 * 1024;       // 512 KB

// 📥 Скачивание изображения
async function downloadImage(url) {
  console.log('📥 Скачиваю изображение...');
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: MAX_INPUT_SIZE,
    });
    const buffer = Buffer.from(response.data);
    console.log(`✅ Скачано: ${Math.round(buffer.length / 1024)} КБ`);
    return buffer;
  } catch (err) {
    console.error('❌ Ошибка скачивания:', err.message);
    throw new Error('Не удалось скачать изображение');
  }
}

// 🎯 Умная обрезка с учётом ориентации
async function smartCrop(imageBuffer) {
  console.log('🎯 Обрезка изображения...');
  const meta = await sharp(imageBuffer).metadata();
  const { width, height, orientation } = meta;

  const min = Math.min(width, height);
  const img = sharp(imageBuffer, { failOn: 'none' })
    .rotate() // исправление ориентации по EXIF
    .extract({
      left: Math.floor((width - min) / 2),
      top: Math.floor((height - min) / 2),
      width: min,
      height: min,
    })
    .resize(STICKER_SIZE, STICKER_SIZE, {
      fit: 'cover',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ palette: true, colors: 256 });

  return img.toBuffer();
}

// 🎭 Эффекты (без затемнения!)
async function applyEffect(imageBuffer, effect = 'none') {
  if (!effect || effect === 'none') return imageBuffer;
  console.log(`🎭 Применяю эффект: ${effect}`);

  let img = sharp(imageBuffer);

  switch (effect.toLowerCase()) {
    case 'vintage':
      img = img.modulate({ saturation: 0.85 }).tint({ r: 255, g: 240, b: 200 });
      break;

    case 'grayscale':
      img = img.grayscale();
      break;

    case 'sepia':
      img = img.tint({ r: 255, g: 240, b: 192 });
      break;

    case 'pixelate': {
      const meta = await sharp(imageBuffer).metadata();
      const pixel = 8;
      img = img
        .resize(Math.floor(meta.width / pixel), Math.floor(meta.height / pixel))
        .resize(meta.width, meta.height, { kernel: 'nearest' });
      break;
    }

    case 'blur':
      img = img.blur(5);
      break;

    default:
      console.warn(`⚠️ Неизвестный эффект: ${effect}`);
      return imageBuffer;
  }

  return img.png({ palette: true }).toBuffer();
}

// 📦 Уменьшение размера до 512 КБ
async function optimizeStickerSize(buffer) {
  if (buffer.length <= MAX_OUTPUT_SIZE) return buffer;

  console.log('📦 Оптимизация размера...');
  let out = buffer;
  let scale = 0.9;

  while (out.length > MAX_OUTPUT_SIZE && scale > 0.4) {
    const newSize = Math.round(STICKER_SIZE * scale);
    out = await sharp(buffer)
      .resize(newSize, newSize, { kernel: 'lanczos3' })
      .png({ palette: true, colors: 128, effort: 10 })
      .toBuffer();
    scale -= 0.1;
  }

  console.log(`✅ Оптимизировано до ${Math.round(out.length / 1024)} КБ`);
  return out;
}

// 🎨 Создание стикера
async function createSticker(imageBuffer, effect = 'none') {
  console.log('🎨 Создаю стикер...');
  try {
    const cropped   = await smartCrop(imageBuffer);
    const effected  = await applyEffect(cropped, effect);
    const optimized = await optimizeStickerSize(effected);

    console.log(`✅ Стикер готов: ${optimized.length} байт`);
    return optimized;
  } catch (err) {
    console.error('❌ Ошибка создания стикера:', err);
    throw err;
  }
}

module.exports = {
  downloadImage,
  createSticker,
  applyEffect,
  smartCrop,
  optimizeStickerSize,
};
