// lib/imageProcessor.js
const axios = require('axios');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs/promises');

const MAX_INPUT_SIZE  = 10 * 1024 * 1024; // 10 MB
const STICKER_SIZE    = 512;              // Telegram max
const MAX_OUTPUT_SIZE = 512 * 1024;       // 512 KB

async function downloadImage(url) {
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: MAX_INPUT_SIZE
  });
  return Buffer.from(resp.data);
}

async function smartCrop(imageBuffer) {
  // rotate first, then metadata, then crop based on rotated dimensions
  let img = sharp(imageBuffer, { failOnError: false }).rotate();
  const meta = await img.metadata();
  const { width, height } = meta;

  if (!width || !height) {
    // fallback: simple resize square
    return img
      .resize(STICKER_SIZE, STICKER_SIZE, { fit: 'cover' })
      .png({ palette: true, colors: 256 })
      .toBuffer();
  }

  const min = Math.min(width, height);
  const left = Math.floor((width - min) / 2);
  const top = Math.floor((height - min) / 2);

  return img
    .extract({ left, top, width: min, height: min })
    .resize(STICKER_SIZE, STICKER_SIZE, { fit: 'cover', kernel: sharp.kernel.lanczos3 })
    .png({ palette: true, colors: 256 })
    .toBuffer();
}

async function applyEffect(imageBuffer, effectName) {
  if (!effectName || effectName === 'none') return imageBuffer;

  let img = sharp(imageBuffer);

  switch ((effectName || '').toLowerCase()) {
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
      const w = Math.max(1, Math.floor((meta.width || STICKER_SIZE) / pixel));
      const h = Math.max(1, Math.floor((meta.height || STICKER_SIZE) / pixel));
      img = img.resize(w, h).resize(meta.width || STICKER_SIZE, meta.height || STICKER_SIZE, { kernel: 'nearest' });
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

async function optimizeStickerSize(buffer) {
  if (buffer.length <= MAX_OUTPUT_SIZE) return buffer;

  // Try progressive downscales as PNG palette
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

  // If still too big, convert to webp
  if (out.length > MAX_OUTPUT_SIZE) {
    out = await sharp(buffer)
      .resize(Math.max(256, Math.round(STICKER_SIZE * 0.75)), Math.max(256, Math.round(STICKER_SIZE * 0.75)), { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();
  }
  return out;
}

// Save buffer to disk under /tmp (Vercel ephemeral) with uuid name
async function saveLocalSticker(buffer, filename) {
  const dir = process.env.STICKER_LOCAL_DIR || '/tmp/stickers';
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function createSticker(imageBuffer, effect = 'none') {
  const cropped = await smartCrop(imageBuffer);
  const effected = await applyEffect(cropped, effect);
  const optimized = await optimizeStickerSize(effected);
  return optimized;
}

module.exports = {
  downloadImage,
  createSticker,
  saveLocalSticker
};
