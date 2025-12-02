// 🎨 МИНИМАЛЬНАЯ ОБРАБОТКА ИЗОБРАЖЕНИЙ (без внешних зависимостей)

// 📥 Скачивание изображения
async function downloadImage(url) {
  console.log('📥 Скачиваю изображение...');
  try {
    const response = await fetch(url, { timeout: 30000 });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ Изображение скачано: ${arrayBuffer.byteLength} байт`);
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('❌ Ошибка скачивания изображения:', error.message);
    throw error;
  }
}

// 🎨 Создание стикера (просто возвращаем изображение)
async function createSticker(imageBuffer, effect = 'none') {
  console.log(`🎨 Создаю стикер с эффектом: ${effect}`);
  
  // Telegram сам обработает изображение как стикер
  // Главное - отправить PNG/JPG
  console.log(`✅ Стикер готов! Размер: ${imageBuffer.length} байт`);
  return imageBuffer;
}

// 🎭 Заглушка для эффектов
async function applyEffect(imageBuffer, effectName) {
  console.log(`🎭 Эффект "${effectName}" (в разработке)`);
  return imageBuffer;
}

module.exports = {
  downloadImage,
  createSticker,
  applyEffect
};
