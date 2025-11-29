import fs from 'fs-extra';
import path from 'path';

const STICKER_DIR = './stickers';

fs.ensureDirSync(STICKER_DIR);

export async function saveSticker(buffer, filename) {
  const filePath = path.join(STICKER_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}
