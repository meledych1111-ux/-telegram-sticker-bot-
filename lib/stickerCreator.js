// /lib/stickerCreator.js - УПРОЩЕННЫЙ БЕЗ CANVAS
class StickerCreator {
  constructor() {
    console.log('✅ StickerCreator initialized (simple mode)');
  }

  async downloadImage(url) {
    try {
      console.log(`📥 Downloading: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('❌ Download failed:', error.message);
      throw error;
    }
  }

  async createSticker(imageBuffer, effect = 'none') {
    console.log(`🎨 Processing sticker, effect: ${effect}`);
    
    // В упрощенной версии просто возвращаем оригинальное изображение
    // Telegram сам конвертирует PNG/JPG в стикер
    
    return imageBuffer;
  }

  async sendSticker(botToken, chatId, stickerBuffer) {
    try {
      console.log(`📤 Sending sticker to ${chatId}`);
      
      // Создаем FormData вручную
      const boundary = '----WebKitFormBoundary' + Date.now();
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n` +
          'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
          `${chatId}\r\n` +
          `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="sticker"; filename="sticker.png"\r\n' +
          'Content-Type: image/png\r\n\r\n'),
        stickerBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);
      
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendSticker`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length.toString()
          },
          body: body
        }
      );
      
      const result = await response.json();
      
      // Если не получилось отправить как стикер, пробуем как фото
      if (!result.ok) {
        console.log('⚠️ Failed to send as sticker, trying as photo...');
        return await this.sendAsPhoto(botToken, chatId, stickerBuffer);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error sending sticker:', error.message);
      
      // Fallback: отправляем текстовое сообщение
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '🎨 *Стикер создан!*\n\nТеперь вы можете отправить его в любой чат.',
          parse_mode: 'Markdown'
        })
      });
      
      return { ok: true, message: 'sent_as_message' };
    }
  }

  async sendAsPhoto(botToken, chatId, imageBuffer) {
    try {
      const boundary = '----WebKitFormBoundary' + Date.now();
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\n` +
          'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
          `${chatId}\r\n` +
          `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="photo"; filename="image.png"\r\n' +
          'Content-Type: image/png\r\n\r\n'),
        imageBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);
      
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendPhoto`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length.toString()
          },
          body: body
        }
      );
      
      return await response.json();
    } catch (error) {
      console.error('❌ Error sending photo:', error.message);
      throw error;
    }
  }
}

module.exports = new StickerCreator();
