// api/bot.js - Фиксированная версия для Vercel
const TelegramBot = require('node-telegram-bot-api');
const { Pool } = require('pg');

// ========== КОНФИГУРАЦИЯ ==========
const config = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8497134153:AAEQtYTVv-hCQ08HkD6Wwm6k2qsjmCHCgJI',
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
  VERCEL_URL: process.env.VERCEL_URL || 'https://telegram-sticker-bot-tau.vercel.app',
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
};

// Проверка токена
if (!config.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
  process.exit(1);
}

// ========== ИНИЦИАЛИЗАЦИЯ БОТА ==========
const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {
  polling: false
});

// ========== NEON DATABASE ==========
let dbPool;
if (config.NEON_DATABASE_URL) {
  try {
    dbPool = new Pool({
      connectionString: config.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    // Проверяем подключение
    dbPool.query('SELECT NOW()', (err) => {
      if (err) {
        console.error('❌ Ошибка подключения к Neon:', err.message);
      } else {
        console.log('✅ Neon Database подключена');
      }
    });
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error.message);
  }
}

// ========== КОМАНДЫ БОТА ==========
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = msg.from;
  
  // Сохраняем пользователя если есть БД
  if (dbPool) {
    try {
      await dbPool.query(`
        INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (telegram_id) DO UPDATE SET
          username = EXCLUDED.username,
          last_active = CURRENT_TIMESTAMP
      `, [
        user.id,
        user.username,
        user.first_name,
        user.last_name,
        user.language_code
      ]);
    } catch (error) {
      console.error('❌ Ошибка сохранения пользователя:', error.message);
    }
  }
  
  const welcomeText = `🎨 *Добро пожаловать в Sticker Bot!*\n\n` +
    `Я помогу вам создать стикеры из ваших изображений.\n\n` +
    `📸 *Как использовать:*\n` +
    `1. Отправьте мне любое изображение\n` +
    `2. Я обработаю его\n` +
    `3. Вы получите готовый стикер\n\n` +
    `💾 *База данных:* ${dbPool ? '✅ Neon' : '❌ Нет'}\n` +
    `🔗 *Вебхук:* ${config.VERCEL_URL}\n\n` +
    `*Команды:*\n` +
    `/help - Помощь\n` +
    `/stats - Статистика\n` +
    `/dbinfo - Информация о БД`;
  
  await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🆘 *Помощь по боту*\n\n` +
    `Поддерживаемые форматы: PNG, JPG, JPEG, WEBP\n` +
    `Максимальный размер: 20MB\n\n` +
    `Просто отправьте мне изображение!`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!dbPool) {
    await bot.sendMessage(chatId, '❌ База данных не настроена', { parse_mode: 'Markdown' });
    return;
  }
  
  try {
    const result = await dbPool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM stickers) as total_stickers
    `);
    
    const stats = result.rows[0];
    await bot.sendMessage(chatId,
      `📊 *Статистика бота:*\n\n` +
      `👥 Пользователей: *${stats.total_users}*\n` +
      `🎨 Стикеров: *${stats.total_stickers}*\n\n` +
      `🌐 *Сервер:* Vercel\n` +
      `💾 *БД:* Neon\n` +
      `⚡ *Статус:* Активен`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    await bot.sendMessage(chatId, '❌ Ошибка получения статистики', { parse_mode: 'Markdown' });
  }
});

bot.onText(/\/dbinfo/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!dbPool) {
    await bot.sendMessage(chatId, '❌ База данных Neon не настроена', { parse_mode: 'Markdown' });
    return;
  }
  
  try {
    const dbInfo = await dbPool.query(`
      SELECT 
        version() as pg_version,
        current_database() as db_name,
        current_user as db_user,
        inet_server_addr() as db_host,
        inet_server_port() as db_port
    `);
    
    const info = dbInfo.rows[0];
    await bot.sendMessage(chatId,
      `💾 *Информация о базе данных:*\n\n` +
      `📊 PostgreSQL: ${info.pg_version.split(',')[0]}\n` +
      `🗄️ База: ${info.db_name}\n` +
      `👤 Пользователь: ${info.db_user}\n` +
      `🌐 Хост: ${info.db_host}\n` +
      `🔌 Порт: ${info.db_port}\n\n` +
      `✅ Подключение установлено`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('❌ Ошибка получения информации о БД:', error);
    await bot.sendMessage(chatId, '❌ Ошибка подключения к БД', { parse_mode: 'Markdown' });
  }
});

// Обработка изображений
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendChatAction(chatId, 'upload_photo');
  await bot.sendMessage(chatId, '📸 *Получил изображение!*\n\nОбрабатываю...', { parse_mode: 'Markdown' });
  
  // Сохраняем в БД если есть подключение
  if (dbPool) {
    try {
      const photo = msg.photo[msg.photo.length - 1];
      const user = msg.from;
      
      // Сохраняем стикер
      await dbPool.query(`
        WITH user_insert AS (
          INSERT INTO users (telegram_id, username, first_name, last_name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (telegram_id) DO UPDATE SET last_active = CURRENT_TIMESTAMP
          RETURNING id
        )
        INSERT INTO stickers (user_id, telegram_file_id, file_unique_id, width, height, file_size)
        SELECT (SELECT id FROM user_insert), $5, $6, $7, $8, $9
      `, [
        user.id,
        user.username,
        user.first_name,
        user.last_name,
        photo.file_id,
        photo.file_unique_id,
        photo.width,
        photo.height,
        photo.file_size
      ]);
    } catch (error) {
      console.error('❌ Ошибка сохранения стикера:', error.message);
    }
  }
  
  // Пока просто подтверждаем получение
  setTimeout(async () => {
    await bot.sendMessage(chatId,
      `✅ *Обработка завершена!*\n\n` +
      `К сожалению, функция создания стикеров временно недоступна.\n\n` +
      `*Что работает:*\n` +
      `• Получение изображений ✅\n` +
      `• Сохранение в БД ✅\n` +
      `• Статистика ✅\n\n` +
      `Функция создания стикеров будет добавлена позже!`,
      { parse_mode: 'Markdown' }
    );
  }, 2000);
});

// ========== VERCEL HANDLER ==========
module.exports = async (req, res) => {
  // Настройка вебхука
  if (req.url === '/setup-webhook' || req.query.action === 'setup') {
    try {
      const webhookUrl = `${config.VERCEL_URL}/api/bot`;
      await bot.setWebHook(webhookUrl);
      
      const botInfo = await bot.getMe();
      res.json({
        success: true,
        message: 'Webhook установлен',
        webhook: webhookUrl,
        bot: `@${botInfo.username}`,
        database: dbPool ? 'Neon ✅' : 'Not configured'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
    return;
  }
  
  // Проверка здоровья
  if (req.url === '/health' || req.query.action === 'health') {
    let dbStatus = 'disconnected';
    if (dbPool) {
      try {
        await dbPool.query('SELECT 1');
        dbStatus = 'connected';
      } catch (error) {
        dbStatus = 'error: ' + error.message;
      }
    }
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Telegram Sticker Bot',
      version: '2.0.0',
      runtime: 'Node.js 24',
      database: dbStatus,
      webhook: `${config.VERCEL_URL}/api/bot`
    });
    return;
  }
  
  // Обработка вебхука Telegram
  if (req.method === 'POST') {
    try {
      await bot.processUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Ошибка обработки вебхука:', error);
      res.status(500).send('Error');
    }
    return;
  }
  
  // Главная страница
  if (req.method === 'GET') {
    res.json({
      service: 'Telegram Sticker Bot API',
      status: 'running',
      version: '2.0.0',
      endpoints: {
        webhook: 'POST /api/bot',
        setup: 'GET /setup-webhook',
        health: 'GET /health',
        home: 'GET /'
      },
      database: dbPool ? 'Neon PostgreSQL ✅' : 'Not configured',
      bot_token: config.TELEGRAM_BOT_TOKEN ? 'Configured' : 'Missing'
    });
    return;
  }
  
  res.status(404).send('Not Found');
};

// ========== ЗАПУСК СЕРВЕРА ==========
if (require.main === module) {
  const port = process.env.PORT || 3000;
  const server = require('http').createServer((req, res) => {
    module.exports(req, res);
  });
  
  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`🤖 Bot token: ${config.TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
    console.log(`💾 Database: ${dbPool ? 'Neon ✅' : 'Not configured'}`);
    
    // Устанавливаем вебхук автоматически
    const webhookUrl = `${config.VERCEL_URL}/api/bot`;
    bot.setWebHook(webhookUrl).then(() => {
      console.log(`✅ Webhook установлен: ${webhookUrl}`);
    }).catch(err => {
      console.error('❌ Ошибка установки вебхука:', err.message);
    });
  });
}
