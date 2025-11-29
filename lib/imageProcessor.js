// 🎨  lib/imageProcessor.js – чистая обработка изображений
const axios = require('axios');
const sharp = require('sharp');

const MAX_INPUT_SIZE  = 10 * 1024 * 1024; // 10 MB
const STICKER_SIZE    = 512;              // Telegram max
const MAX_OUTPUT_SIZE = 512 * 1024;       // 512 KB

async function downloadImage(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: MAX_INPUT_SIZE
  });
  return Buffer.from(response.data);
}

async function createSticker(imageBuffer, effect = 'none') {
  const cropped = await smartCrop(imageBuffer);
  const effected = await applyEffect(cropped, effect);
  return optimizeStickerSize(effected);
}

/* ----------  обрезка + поворот по EXIF  ---------- */
async function smartCrop(imageBuffer) {
  const meta = await sharp(imageBuffer, { failOn: 'none' }).metadata();
  const { width, height, orientation } = meta;
  const min = Math.min(width, height);

  let img = sharp(imageBuffer, { failOn: 'none' }).rotate(); // EXIF

  const cropped = await img
    .extract({ left: Math.floor((width - min) / 2),
               top: Math.floor((height - min) / 2),
               width: min, height: min })
    .resize(STICKER_SIZE, STICKER_SIZE, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .png({ palette: true, colors: 256 })
    .toBuffer();
  return cropped;
}

/* ----------  эффекты  ---------- */
async function applyEffect(imageBuffer, effectName) {
  if (!effectName || effectName === 'none') return imageBuffer;

  let img = sharp(imageBuffer);

  switch (effectName.toLowerCase()) {
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
      img = img.resize(Math.floor(meta.width / pixel), Math.floor(meta.height / pixel))
               .resize(meta.width, meta.height, { kernel: 'nearest' });
      break;
    }
    case 'blur':
      img = img.blur(5);
      break;
    default:
      return imageBuffer;
  }

  return img.png({ palette: true }).toBuffer();
}

/* ----------  размер ≤ 512 КБ  ---------- */
async function optimizeStickerSize(buffer) {
  if (buffer.length <= MAX_OUTPUT_SIZE) return buffer;

  let out = buffer;
  let scale = 0.9;
  while (out.length > MAX_OUTPUT_SIZE && scale > 0.4) {
    const sz = Math.round(STICKER_SIZE * scale);
    out = await sharp(buffer)
      .resize(sz, sz, { kernel: 'lanczos3' })
      .png({ palette: true, colors: 128, effort: 10 })
      .toBuffer();
    scale -= 0.1;
  }
  return out;
}

module.exports = { downloadImage, createSticker };
