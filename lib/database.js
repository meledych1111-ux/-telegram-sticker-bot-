const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Подключение к Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Проверка соединения
async function checkConnection() {
  try {
    await pool.query('SELECT NOW()');
    return true;
  } catch (error) {
    console.error('❌ Нет соединения с БД:', error.message);
    return false;
  }
}

// Инициализация базы данных
async function initDatabase() {
  try {
    console.log('🔄 Инициализация базы данных...');
    
    await pool.query(`
      -- Пользователи
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        language_code VARCHAR(10),
        is_premium BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        stickers_created INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 5.00
      );

      -- Стикеры
      CREATE TABLE IF NOT EXISTS stickers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        telegram_file_id VARCHAR(255) NOT NULL,
        file_unique_id VARCHAR(255) NOT NULL,
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
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Рейтинги
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        sticker_id UUID REFERENCES stickers(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sticker_id, user_id)
      );

      -- Папки
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(20) DEFAULT '#667eea',
        sticker_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Стикеры в папках
      CREATE TABLE IF NOT EXISTS folder_stickers (
        folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
        sticker_id UUID REFERENCES stickers(id) ON DELETE CASCADE,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (folder_id, sticker_id)
      );

      -- Статистика
      CREATE TABLE IF NOT EXISTS bot_stats (
        date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
        total_users INTEGER DEFAULT 0,
        total_stickers INTEGER DEFAULT 0,
        daily_stickers INTEGER DEFAULT 0,
        active_users INTEGER DEFAULT 0,
        requests_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Индексы
      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_stickers_user_id ON stickers(user_id);
      CREATE INDEX IF NOT EXISTS idx_stickers_created_at ON stickers(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ratings_sticker_id ON ratings(sticker_id);
      CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_bot_stats_date ON bot_stats(date DESC);
    `);

    // Создаем функцию для uuid если нет
    await pool.query(`
      CREATE OR REPLACE FUNCTION uuid_generate_v4()
      RETURNS uuid
      LANGUAGE sql
      AS $$
        SELECT gen_random_uuid();
      $$;
    `);

    console.log('✅ База данных инициализирована');
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    throw error;
  }
}

// Получить или создать пользователя
async function getOrCreateUser(telegramUser) {
  try {
    const result = await pool.query(`
      INSERT INTO users (telegram_id, username, first_name, last_name, language_code, last_active)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (telegram_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        language_code = EXCLUDED.language_code,
        last_active = NOW()
      RETURNING *
    `, [
      telegramUser.id,
      telegramUser.username,
      telegramUser.first_name,
      telegramUser.last_name,
      telegramUser.language_code
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка getOrCreateUser:', error);
    throw error;
  }
}

// Сохранить стикер
async function saveSticker(stickerData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const stickerResult = await client.query(
      `INSERT INTO stickers (
        user_id, telegram_file_id, file_unique_id,
        width, height, file_size, mime_type,
        has_frame, frame_color, has_pearl_effect,
        has_gradient, text_overlay
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        stickerData.user_id,
        stickerData.telegram_file_id,
        stickerData.file_unique_id,
        stickerData.width,
        stickerData.height,
        stickerData.file_size,
        stickerData.mime_type,
        stickerData.has_frame,
        stickerData.frame_color,
        stickerData.has_pearl_effect,
        stickerData.has_gradient,
        stickerData.text_overlay
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
    
    // Обновляем статистику
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
        COUNT(s.id) as total_stickers,
        COUNT(DISTINCT f.id) as folders_count,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COALESCE(SUM(s.likes_count), 0) as total_likes,
        COALESCE(SUM(s.views_count), 0) as total_views,
        COALESCE(SUM(s.downloads_count), 0) as total_downloads
      FROM users u
      LEFT JOIN stickers s ON u.id = s.user_id
      LEFT JOIN folders f ON u.id = f.user_id
      LEFT JOIN ratings r ON s.id = r.sticker_id
      WHERE u.telegram_id = $1
      GROUP BY u.id`,
      [telegramId]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка getStats:', error);
    return null;
  }
}

// Получить системную статистику
async function getSystemStats() {
  try {
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM stickers) as total_stickers,
        (SELECT COALESCE(daily_stickers, 0) FROM bot_stats WHERE date = CURRENT_DATE) as daily_stickers,
        (SELECT COALESCE(requests_count, 0) FROM bot_stats WHERE date = CURRENT_DATE) as today_requests,
        (SELECT COUNT(DISTINCT user_id) FROM stickers WHERE created_at >= NOW() - INTERVAL '24 hours') as active_users
    `);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка getSystemStats:', error);
    return null;
  }
}

// Топ пользователей
async function getTopUsers(limit = 10) {
  try {
    const result = await pool.query(
      `SELECT 
        u.username,
        u.first_name,
        u.stickers_created,
        COUNT(DISTINCT s.id) as total_stickers,
        COALESCE(SUM(s.likes_count), 0) as total_likes,
        COALESCE(AVG(r.rating), 0) as avg_rating
      FROM users u
      LEFT JOIN stickers s ON u.id = s.user_id
      LEFT JOIN ratings r ON s.id = r.sticker_id
      WHERE u.stickers_created > 0
      GROUP BY u.id
      ORDER BY u.stickers_created DESC, total_likes DESC
      LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('❌ Ошибка getTopUsers:', error);
    return [];
  }
}

// Создать папку
async function createFolder(userId, name, color = '#667eea') {
  try {
    const result = await pool.query(
      `INSERT INTO folders (user_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, name, color]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка createFolder:', error);
    throw error;
  }
}

// Добавить стикер в папку
async function addStickerToFolder(folderId, stickerId) {
  try {
    await pool.query(
      `INSERT INTO folder_stickers (folder_id, sticker_id)
       VALUES ($1, $2)
       ON CONFLICT (folder_id, sticker_id) DO NOTHING`,
      [folderId, stickerId]
    );
    
    // Обновляем счетчик папки
    await pool.query(
      `UPDATE folders SET sticker_count = sticker_count + 1
       WHERE id = $1`,
      [folderId]
    );
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка addStickerToFolder:', error);
    throw error;
  }
}

// Добавить рейтинг
async function addRating(stickerId, userId, rating, comment = null) {
  try {
    const result = await pool.query(
      `INSERT INTO ratings (sticker_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (sticker_id, user_id) 
       DO UPDATE SET rating = EXCLUDED.rating,
                     comment = EXCLUDED.comment
       RETURNING *`,
      [stickerId, userId, rating, comment]
    );
    
    // Обновляем счетчик лайков
    if (rating >= 4) {
      await pool.query(
        `UPDATE stickers SET likes_count = likes_count + 1
         WHERE id = $1`,
        [stickerId]
      );
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка addRating:', error);
    throw error;
  }
}

// Инициализация при импорте
if (process.env.NODE_ENV !== 'test') {
  initDatabase().catch(console.error);
}

module.exports = {
  pool,
  checkConnection,
  initDatabase,
  getOrCreateUser,
  saveSticker,
  getStats,
  getSystemStats,
  getTopUsers,
  createFolder,
  addStickerToFolder,
  addRating
};
