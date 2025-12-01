const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Инициализация бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Команда /start
bot.start((ctx) => {
  ctx.reply(
    '👋 Привет! Я бот для создания стикеров.\n\n' +
    'Отправь мне любое изображение (PNG, JPEG, WebP), ' +
    'и я превращу его в стикер для Telegram!\n\n' +
    'Просто отправь мне картинку с подписью "стикер" или используй команду /sticker'
  );
});

// Команда /help
bot.help((ctx) => {
  ctx.reply(
    '📌 Как использовать бота:\n\n' +
    '1. Отправь мне изображение (PNG, JPEG, WebP)\n' +
    '2. Я автоматически преобразую его в стикер\n' +
    '3. Добавь эмодзи для стикера (опционально)\n\n' +
    '⚠️ Требования к изображениям:\n' +
    '• Размер файла: до 5 МБ\n' +
    '• Формат: PNG, JPEG, WebP\n' +
    '• Рекомендуемый размер: 512x512 пикселей\n\n' +
    'Команды:\n' +
    '/start - Начать работу\n' +
    '/help - Помощь\n' +
    '/sticker - Создать стикер из последнего изображения'
  );
});

// Обработка изображений
bot.on('photo', async (ctx) => {
  try {
    const message = ctx.message;
    const photo = message.photo[message.photo.length - 1];
    
    // Получаем эмодзи из подписи (если есть)
    const emoji = message.caption || '😀';
    
    // Отправляем сообщение о обработке
    const processingMsg = await ctx.reply('🔄 Обрабатываю изображение...');
    
    // Получаем файл
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    
    // Скачиваем изображение
    const response = await fetch(fileLink.href);
    const imageBuffer = await response.buffer();
    
    // Создаем новый стикер
    await createSticker(ctx, imageBuffer, emoji);
    
    // Удаляем сообщение о обработке
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    
  } catch (error) {
    console.error('Error processing photo:', error);
    ctx.reply('❌ Произошла ошибка при обработке изображения. Попробуйте еще раз.');
  }
});

// Обработка документов (изображений)
bot.on('document', async (ctx) => {
  try {
    const document = ctx.message.document;
    const mimeType = document.mime_type;
    
    // Проверяем, что это изображение
    if (!mimeType || !mimeType.startsWith('image/')) {
      return ctx.reply('⚠️ Пожалуйста, отправьте изображение (PNG, JPEG, WebP)');
    }
    
    // Проверяем размер файла (максимум 5 МБ)
    if (document.file_size > 5 * 1024 * 1024) {
      return ctx.reply('⚠️ Файл слишком большой. Максимальный размер: 5 МБ');
    }
    
    const emoji = ctx.message.caption || '😀';
    const processingMsg = await ctx.reply('🔄 Обрабатываю изображение...');
    
    // Получаем файл
    const fileLink = await ctx.telegram.getFileLink(document.file_id);
    
    // Скачиваем изображение
    const response = await fetch(fileLink.href);
    const imageBuffer = await response.buffer();
    
    // Создаем стикер
    await createSticker(ctx, imageBuffer, emoji);
    
    // Удаляем сообщение о обработке
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
    
  } catch (error) {
    console.error('Error processing document:', error);
    ctx.reply('❌ Произошла ошибка при обработке изображения.');
  }
});

// Команда /sticker для повторной попытки
bot.command('sticker', async (ctx) => {
  ctx.reply('📸 Отправьте мне изображение, и я превращу его в стикер!');
});

// Функция создания стикера
async function createSticker(ctx, imageBuffer, emoji) {
  try {
    // Создаем временный стикер
    const form = new FormData();
    form.append('sticker', imageBuffer, { filename: 'sticker.png' });
    form.append('emoji_list', JSON.stringify([emoji]));
    
    // Используем метод createNewStickerSet или addStickerToSet
    // В зависимости от того, есть ли у пользователя уже набор стикеров
    
    // Для простоты создаем новый стикер в существующем наборе
    // или отправляем как обычный файл
    
    // Альтернативный подход: отправляем как документ
    await ctx.replyWithSticker({ source: imageBuffer });
    
  } catch (error) {
    console.error('Error creating sticker:', error);
    
    // Если не удалось создать стикер, отправляем оригинальное изображение
    await ctx.replyWithPhoto({ source: imageBuffer });
    ctx.reply('⚠️ Не удалось создать стикер. Отправляю оригинальное изображение.');
  }
}

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('❌ Произошла непредвиденная ошибка.');
});

// Webhook обработчик для Vercel
module.exports = async (req, res) => {
  try {
    // Проверяем метод запроса
    if (req.method === 'POST') {
      // Парсим тело запроса
      const body = req.body || {};
      
      // Обрабатываем обновление
      await bot.handleUpdate(body);
      
      res.status(200).json({ ok: true });
    } else if (req.method === 'GET') {
      // Проверка работоспособности
      res.status(200).json({
        status: 'Bot is running',
        timestamp: new Date().toISOString(),
        platform: 'Vercel Node.js'
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Локальный запуск (для разработки)
if (process.env.NODE_ENV === 'development') {
  bot.launch().then(() => {
    console.log('Bot is running in development mode');
  });
}
