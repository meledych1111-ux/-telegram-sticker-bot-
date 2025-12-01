const { Pool } = require('pg');

// Конфигурация пула соединений
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  max: 20, // максимальное количество клиентов в пуле
  idleTimeoutMillis: 30000, // закрыть неиспользуемые соединения через 30 секунд
  connectionTimeoutMillis: 10000, // таймаут подключения 10 секунд
  maxUses: 7500, // перезапускать соединение после 7500 запросов
});

// Обработчики событий пула
pool.on('connect', () => {
  console.log('✅ Новое соединение с БД установлено');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка пула БД:', err);
});

// Проверка соединения
async function checkConnection() {
  try {
    const result = await pool.query('SELECT NOW() as time, version() as version');
    console.log('🔌 БД подключена:', {
      time: result.rows[0].time,
      version: result.rows[0].version.split(' ')[1]
    });
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error.message);
    return false;
  }
}

// Инициализация таблиц
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Инициализация базы данных...');
    
    await client.query('BEGIN');
    
    // Таблица пользователей
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        language_code VARCHAR(10),
        is_premium BOOLEAN DEFAULT false,
        is_bot BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        stickers_created INTEGER DEFAULT 0,
        CONSTRAINT unique_telegram_id UNIQUE(telegram_id)
      );
    `);
    
    // Таблица стикеров
    await client.query(`
      CREATE TABLE IF NOT EXISTS stickers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        telegram_file_id VARCHAR(255) UNIQUE NOT NULL,
        file_unique_id VARCHAR(255) UNIQUE NOT NULL,
        emoji VARCHAR(10) DEFAULT '😀',
        width INTEGER,
        height INTEGER,
        file_size INTEGER,
        mime_type VARCHAR(50),
        has_frame BOOLEAN DEFAULT false,
        frame_color VARCHAR(50),
        has_pearl_effect BOOLEAN DEFAULT false,
        has_gradient BOOLEAN DEFAULT false,
        text_overlay VARCHAR(200),
        is_public BOOLEAN DEFAULT true,
        views_count INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        downloads_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id)
      );
    `);
    
    // Таблица рейтингов
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        sticker_id UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sticker_id, user_id)
      );
    `);
    
    // Таблица папок
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#667eea',
        sticker_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Связь стикеров с папками
    await client.query(`
      CREATE TABLE IF NOT EXISTS folder_stickers (
        folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        sticker_id UUID NOT NULL REFERENCES stickers(id) ON DELETE CASCADE,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (folder_id, sticker_id)
      );
    `);
    
    // Статистика
    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_stats (
        date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
        total_users INTEGER DEFAULT 0,
        total_stickers INTEGER DEFAULT 0,
        daily_stickers INTEGER DEFAULT 0,
        active_users INTEGER DEFAULT 0,
        requests_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Индексы для производительности
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_stickers_user_id ON stickers(user_id);
      CREATE INDEX IF NOT EXISTS idx_stickers_created_at ON stickers(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ratings_sticker_id ON ratings(sticker_id);
      CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
      CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_bot_stats_date ON bot_stats(date DESC);
    `);
    
    await client.query('COMMIT');
    console.log('✅ База данных инициализирована');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка инициализации БД:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Получить или создать пользователя
async function getOrCreateUser(telegramUser) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `INSERT INTO users (
        telegram_id, username, first_name, last_name, 
        language_code, is_bot, last_active
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        language_code = EXCLUDED.language_code,
        last_active = NOW()
      RETURNING id, telegram_id, username, stickers_created, created_at`,
      [
        telegramUser.id,
        telegramUser.username,
        telegramUser.first_name,
        telegramUser.last_name,
        telegramUser.language_code,
        telegramUser.is_bot || false
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка getOrCreateUser:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Сохранить стикер
async function saveSticker(stickerData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Сохраняем стикер
    const stickerResult = await client.query(
      `INSERT INTO stickers (
        user_id, telegram_file_id, file_unique_id,
        width, height, file_size, mime_type,
        has_frame, frame_color, has_pearl_effect
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at`,
      [
        stickerData.user_id,
        stickerData.telegram_file_id,
        stickerData.file_unique_id,
        stickerData.width,
        stickerData.height,
        stickerData.file_size,
        stickerData.mime_type || 'image/png',
        stickerData.has_frame !== false,
        stickerData.frame_color || 'white',
        stickerData.has_pearl_effect || false
      ]
    );
    
    // Обновляем счетчик пользователя
    await client.query(
      `UPDATE users 
       SET stickers_created = stickers_created + 1,
           last_active = NOW()
       WHERE id = $1`,
      [stickerData.user_id]
    );
    
    // Обновляем дневную статистику
    await client.query(
      `INSERT INTO bot_stats (date, daily_stickers, total_stickers, requests_count)
       VALUES (CURRENT_DATE, 1, 1, 1)
       ON CONFLICT (date) 
       DO UPDATE SET 
         daily_stickers = bot_stats.daily_stickers + 1,
         total_stickers = (SELECT COUNT(*) FROM stickers),
         requests_count = bot_stats.requests_count + 1`
    );
    
    await client.query('COMMIT');
    return stickerResult.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка saveSticker:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Получить статистику пользователя
async function getStats(telegramId) {
  try {
    const result = await pool.query(
      `SELECT 
        u.*,
        COUNT(s
