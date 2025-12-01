const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
const path = require('path');

console.log('🚀 PRODUCTION Telegram Sticker Bot');
console.log('📅', new Date().toISOString());
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('⚙️ Node.js:', process.version);

// ========== ВАЛИДАЦИЯ ТОКЕНА ==========
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  console.log('\n⚙️ НАСТРОЙКА В VERCEL:');
  console.log('1. Vercel Dashboard → Project → Environment Variables');
  console.log('2. Добавить: TELEGRAM_BOT_TOKEN = ваш_токен_от_BotFather');
  console.log('3. Добавить: NEON_DATABASE_URL = строка_подключения_от_neon');
  console.log('4. Redeploy проект');
  process.exit(1);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const bot = new TelegramBot(BOT_TOKEN, {
  polling: false,
  request: {
    timeout: 10000,
    agentOptions: {
      keepAlive: true
    }
  }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const VERCEL_URL = process.env.VERCEL_URL || 'https://your-project.vercel.app';
const WEBHOOK_URL = `${VERCEL_URL}/api/bot`;

console.log('🤖 Бот инициализирован');
console.log('🌐 Домен:', VERCEL_URL);

// ========== ИМПОРТ МОДУЛЕЙ ==========
const menu = require('../lib/menu');
const database = require('../lib/database');
const imageProcessor = require('../lib/imageProcessor');

// ========== КОМАНДЫ БОТА ==========

// /start - главная команда
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    console.log(`👤 /start от ${user.id} (@${user.username || 'no-username'})`);
    
    const userData = await database.getOrCreateUser(user);
    
    const welcomeText = `🎉 *Добро пожаловать, ${user.first_name || 'друг'}!*\n\n` +
      `🤖 *Telegram Sticker Bot v5.0*\n\n` +
      `✨ *Полный набор функций:*\n` +
      `✅ Создание стикеров из изображений\n` +
      `🎨 Эффекты: рамки, фильтры, текст\n` +
      `💾 Сохранение в Neon PostgreSQL\n` +
      `⭐ Система рейтингов и топов\n` +
      `📂 Организация в папки\n` +
      `📊 Подробная статистика\n\n` +
      `⚡ *Технологии:*\n` +
      `• Node.js 24 на Vercel\n` +
      `• Neon Database\n` +
      `• Автоматическое масштабирование\n\n` +
      `📊 *Ваша статистика:*\n` +
      `• Создано стикеров: ${userData?.stickers_created || 0}\n` +
      `• Рейтинг: ${userData?.rating || 'Новый пользователь'}\n\n` +
      `📸 *Начните прямо сейчас:*\n` +
      `Отправьте изображение или используйте меню!`;
    
    await bot.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu(user.first_name)
    });
    
  } catch (error) {
    console.error('❌ Ошибка /start:', error);
    await bot.sendMessage(chatId, 'Привет! Отправьте изображение для создания стикера 🎨');
  }
});

// /help - помощь
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpText = `🆘 *Помощь и поддержка*\n\n` +
    `📖 *Основные команды:*\n` +
    `/start - Главное меню\n` +
    `/help - Эта справка\n` +
    `/stats - Ваша статистика\n` +
    `/top - Топ пользователей\n` +
    `/settings - Настройки\n` +
    `/report - Сообщить о проблеме\n\n` +
    `🖼️ *Создание стикера:*\n` +
    `1. Отправьте фото или PNG\n` +
    `2. Выберите эффекты из меню\n` +
    `3. Настройте рамку и текст\n` +
    `4. Сохраните готовый стикер\n\n` +
    `🎨 *Доступные эффекты:*\n` +
    `• Рамки разных цветов\n` +
    `• Перламутровый эффект\n` +
    `• Градиентные наложения\n` +
    `• Текстовые подписи\n` +
    `• Автоматическая обрезка\n\n` +
    `📊 *Лимиты:*\n` +
    `• Макс. размер: 20MB\n` +
    `• Форматы: JPG, PNG, WEBP, GIF\n` +
    `• Стикеров на аккаунт: 1000\n` +
    `• Папок на пользователя: 20\n\n` +
    `🔧 *Техподдержка:*\n` +
    `• Проблемы: /report\n` +
    `• Предложения: /suggest\n` +
    `• Контакты: @ваш_никнейм`;
  
  await bot.sendMessage(chatId, helpText, {
    parse_mode: 'Markdown',
    ...menu.mainMenu()
  });
});

// /stats - статистика
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  try {
    const stats = await database.getStats(user.id);
    const systemStats = await database.getSystemStats();
    
    let statsText = `📊 *Детальная статистика*\n\n`;
    
    if (stats) {
      statsText += `👤 *Ваш профиль:*\n` +
                  `• ID: \`${user.id}\`\n` +
                  `• Username: @${user.username || 'нет'}\n` +
                  `• Имя: ${user.first_name}\n\n` +
                  `🎨 *Творчество:*\n` +
                  `• Создано стикеров: *${stats.stickers_created || 0}*\n` +
                  `• Папок: ${stats.folders_count || 0}\n` +
                  `• Средний рейтинг: ${stats.avg_rating?.toFixed(1) || '0.0'}/5\n` +
                  `• Просмотры: ${stats.total_views || 0}\n` +
                  `• Лайки: ${stats.total_likes || 0}\n\n` +
                  `📅 *Активность:*\n` +
                  `• Зарегистрирован: ${new Date(stats.created_at).toLocaleDateString('ru-RU')}\n` +
                  `• Последняя активность: ${new Date(stats.last_active).toLocaleString('ru-RU')}\n\n`;
    }
    
    statsText += `🌐 *Системная статистика:*\n` +
                `• Всего пользователей: ${systemStats?.total_users || 0}\n` +
                `• Всего стикеров: ${systemStats?.total_stickers || 0}\n` +
                `• Стикеров сегодня: ${systemStats?.daily_stickers || 0}\n` +
                `• Активных пользователей: ${systemStats?.active_users || 0}\n\n` +
                `⚙️ *Инфраструктура:*\n` +
                `• Хостинг: Vercel Serverless\n` +
                `• Среда: Node.js 24\n` +
                `• База данных: Neon PostgreSQL\n` +
                `• Вебхук: ${WEBHOOK_URL}\n` +
                `• Uptime: ${Math.floor(process.uptime() / 3600)} часов`;
    
    await bot.sendMessage(chatId, statsText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu()
    });
    
  } catch (error) {
    console.error('❌ Ошибка /stats:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить статистику', menu.mainMenu());
  }
});

// /top - топ пользователей
bot.onText(/\/top/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const topUsers = await database.getTopUsers(10);
    
    let topText = `👑 *Топ-10 пользователей*\n\n`;
    
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    
    topUsers.forEach((user, index) => {
      const medal = medals[index] || '▫️';
      const name = user.first_name || user.username || 'Аноним';
      
      topText += `${medal} *${name}*\n`;
      topText += `   🎨 Стикеров: ${user.stickers_created}\n`;
      topText += `   ⭐ Рейтинг: ${user.avg_rating?.toFixed(1) || '0.0'}/5\n`;
      topText += `   👍 Лайков: ${user.total_likes || 0}\n\n`;
    });
    
    if (topUsers.length === 0) {
      topText += `Пока нет активных пользователей.\nБудьте первым! 🚀\n\n`;
    }
    
    topText += `📈 *Как попасть в топ?*\n` +
              `• Создавайте больше стикеров\n` +
              `• Получайте лайки и оценки\n` +
              `• Делитесь своими работами\n` +
              `• Будьте активны ежедневно\n\n` +
              `🏆 *Ежедневный рейтинг обновляется каждые 24 часа*`;
    
    await bot.sendMessage(chatId, topText, {
      parse_mode: 'Markdown',
      ...menu.mainMenu()
    });
    
  } catch (error) {
    console.error('❌ Ошибка /top:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить топ', menu.mainMenu());
  }
});

// ========== ОБРАБОТКА ИЗОБРАЖЕНИЙ ==========

// Получение фото
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  const photo = msg.photo[msg.photo.length - 1];
  
  try {
    // Проверка размера
    if (photo.file_size > 20 * 1024 * 1024) {
      await bot.sendMessage(chatId, 
        '❌ *Файл слишком большой!*\nМаксимальный размер: 20MB',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    await bot.sendChatAction(chatId, 'upload_photo');
    
    const progressMsg = await bot.sendMessage(
      chatId,
      '📸 *Начинаю обработку изображения...*\n\n' +
      '🔹 Загрузка файла\n' +
      '🔹 Обработка изображения\n' +
      '🔹 Применение эффектов\n' +
      '⏱️ Обычно занимает 5-10 секунд',
      { parse_mode: 'Markdown' }
    );
    
    // Получаем файл
    const fileLink = await bot.getFileLink(photo.file_id);
    
    // Обрабатываем изображение
    const processed = await imageProcessor.processImage(fileLink, {
      addFrame: true,
      frameSize: 20,
      frameColor: 'white',
      addPearlEffect: true,
      addGradient: false,
      addText: '✨ Sticker Bot',
      optimize: true
    });
    
    // Сохраняем в БД
    const dbUser = await database.getOrCreateUser(user);
    const sticker = await database.saveSticker({
      user_id: dbUser.id,
      telegram_file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      width: processed.width,
      height: processed.height,
      file_size: processed.size,
      has_frame: true,
      frame_color: 'white',
      has_pearl_effect: true,
      has_gradient: false,
      text_overlay: 'Sticker Bot',
      mime_type: 'image/png'
    });
    
    // Отправляем обработанное изображение
    await bot.sendPhoto(chatId, processed.buffer, {
      caption: `✅ *Стикер успешно создан!*\n\n` +
              `📐 *Размер:* ${processed.width}x${processed.height} пикселей\n` +
              `💾 *Вес:* ${(processed.size / 1024).toFixed(2)} KB\n` +
              `🎨 *Формат:* PNG (оптимизирован)\n` +
              `✨ *Эффекты:* Рамка + Перламутр + Текст\n` +
              `🆔 *ID стикера:* \`${sticker.id?.slice(0, 8) || 'NEW'}\`\n\n` +
              `📋 *Инструкция по использованию:*\n` +
              `1. Сохраните это изображение\n` +
              `2. В Telegram: "Создать стикер"\n` +
              `3. Выберите сохраненный файл\n` +
              `4. Добавьте эмодзи и название\n\n` +
              `⭐ *Дополнительные действия:*\n` +
              `/rate_${sticker.id?.slice(0, 8)} - Оценить стикер\n` +
              `/save_${sticker.id?.slice(0, 8)} - Сохранить в папку\n` +
              `/share_${sticker.id?.slice(0, 8)} - Поделиться`,
      parse_mode: 'Markdown',
      ...menu.stickerActionsMenu(sticker.id)
    });
    
    // Удаляем сообщение о прогрессе
    await bot.deleteMessage(chatId, progressMsg.message_id);
    
    console.log(`✅ Стикер создан для ${user.id}, размер: ${processed.size} байт`);
    
  } catch (error) {
    console.error('❌ Ошибка обработки фото:', error);
    
    await bot.sendMessage(chatId, 
      `❌ *Произошла ошибка при обработке!*\n\n` +
      `🔧 *Техническая информация:*\n` +
      `• Ошибка: ${error.message || 'Неизвестная ошибка'}\n` +
      `• Время: ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
      `🔄 *Рекомендации:*\n` +
      `• Попробуйте другое изображение\n` +
      `• Убедитесь, что размер < 20MB\n` +
      `• Используйте форматы JPG или PNG\n` +
      `• Если ошибка повторяется, напишите в поддержку\n\n` +
      `📞 *Техподдержка:* @ваш_никнейм`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Обработка документов (PNG и другие форматы)
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const doc = msg.document;
  
  if (doc.mime_type && doc.mime_type.startsWith('image/')) {
    await bot.sendMessage(chatId,
      `📎 *Получен файл: ${doc.file_name}*\n\n` +
      `📄 Формат: ${doc.mime_type}\n` +
      `💾 Размер: ${doc.file_size ? (doc.file_size / 1024).toFixed(2) + ' KB' : 'неизвестно'}\n\n` +
      `✅ Файл принят! Обрабатываю как изображение...`,
      { parse_mode: 'Markdown' }
    );
    
    // Пересылаем как фото для обработки
    msg.photo = [doc];
    bot.emit('photo', msg);
  }
});

// ========== VERCEL SERVERLESS HANDLER ==========

// Вебхук endpoint
app.post('/api/bot', async (req, res) => {
  try {
    await bot.processUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbConnected = await database.checkConnection();
  
  res.json({
    status: 'healthy',
    service: 'Telegram Sticker Bot',
    version: '5.0.0',
    runtime: 'Node.js 24',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    },
    database: dbConnected ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV,
    webhook: WEBHOOK_URL
  });
});

// Admin panel
app.get('/api/admin', async (req, res) => {
  const adminToken = req.query.token;
  
  if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const stats = await database.getSystemStats();
  const topUsers = await database.getTopUsers(5);
  
  res.json({
    bot: {
      token_set: !!BOT_TOKEN,
      webhook: WEBHOOK_URL
    },
    database: stats,
    top_users: topUsers,
    system: {
      node: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ========== ЭКСПОРТ ДЛЯ VERCEL ==========
module.exports = app;

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function initialize() {
  try {
    // Проверяем БД
    const dbConnected = await database.checkConnection();
    console.log(`💾 База данных: ${dbConnected ? 'Neon ✅' : '❌'}`);
    
    // Устанавливаем вебхук
    if (process.env.NODE_ENV === 'production') {
      await bot.setWebHook(WEBHOOK_URL);
      console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
    }
    
    // Информация о боте
    const botInfo = await bot.getMe();
    console.log(`🤖 Бот: @${botInfo.username} (${botInfo.first_name})`);
    
    console.log('\n✅ БОТ УСПЕШНО ЗАПУЩЕН');
    console.log('=======================');
    console.log(`🌐 URL: ${VERCEL_URL}`);
    console.log(`🔗 Webhook: ${WEBHOOK_URL}`);
    console.log(`⚙️ Node.js: ${process.version}`);
    console.log(`💾 Database: ${dbConnected ? 'Connected' : 'Not connected'}`);
    console.log('=======================\n');
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
  }
}

// Автоматическая инициализация при запуске
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, async () => {
    console.log(`🚀 Server started on port ${PORT}`);
    await initialize();
  });
}
