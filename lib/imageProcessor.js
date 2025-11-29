import axios from 'axios';
import sharp from 'sharp';

const STICKER_SIZE = 512;

export async function downloadImage(url) {
  const { data } = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(data);
}

export async function createSticker(buffer, effect='none') {
  let img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const min = Math.min(meta.width, meta.height);

  img = img.extract({ left: Math.floor((meta.width-min)/2), top: Math.floor((meta.height-min)/2), width:min, height:min });
  img = img.resize(STICKER_SIZE, STICKER_SIZE);

  switch(effect) {
    case 'grayscale': img = img.grayscale(); break;
    case 'sepia': img = img.tint({r:255,g:240,b:192}); break;
    case 'vintage': img = img.modulate({saturation:0.85}).tint({r:255,g:240,b:200}); break;
    case 'pixelate': {
      const w = Math.floor(STICKER_SIZE/8);
      img = img.resize(w,w,{kernel:'nearest'}).resize(STICKER_SIZE,STICKER_SIZE,{kernel:'nearest'});
      break;
    }
    case 'blur': img = img.blur(5); break;
  }

  return img.png().toBuffer();
}
