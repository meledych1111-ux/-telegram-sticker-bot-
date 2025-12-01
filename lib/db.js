const { Pool } = require('pg');

// Подключение к Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 2, // Бесплатный Neon имеет лимиты
  idleTimeoutMillis: 10000
});

// Инициализация базы
async function initDB() {
  try {
    await pool.query(`
      -- Пользователи
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        rating INT DEFAULT 100,
        coins INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        stickers_created INT DEFAULT 0,
        last_active TIMESTAMP DEFAULT NOW()
      );
      
      -- Стикеры
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(user_id),
        file_id TEXT UNIQUE,
        file_unique_id TEXT UNIQUE,
        effect TEXT,
        frame TEXT,
        has_text BOOLEAN DEFAULT false,
        text_content TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        likes INT DEFAULT 0,
        views INT DEFAULT 0,
        tags TEXT[]
      );
      
      -- Голоса
      CREATE TABLE IF NOT EXISTS votes (
        user_id BIGINT,
        sticker_id INT REFERENCES stickers(id),
        vote_type TEXT CHECK(vote_type IN ('like', 'dislike')),
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, sticker_id)
      );
      
      -- Достижения
      CREATE TABLE IF NOT EXISTS achievements (
        user_id BIGINT,
        achievement TEXT,
        unlocked_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, achievement)
      );
      
      -- Индексы для скорости
      CREATE INDEX IF NOT EXISTS idx_stickers_popular 
      ON stickers((likes - 0.5*EXTRACT(EPOCH FROM NOW() - created_at)/86400) DESC);
      
      CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
    `);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database init error:', error.message);
  }
}

// Быстрые операции для Vercel (все в одном запросе)
module.exports = {
  pool,
  initDB,
  
  // Пользователи
  async getUser(userId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  },
  
  async createUser(user) {
    const result = await pool.query(
      `INSERT INTO users (user_id, username, first_name, last_name) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username,
       last_active = NOW()
       RETURNING *`,
      [user.id, user.username, user.first_name, user.last_name]
    );
    return result.rows[0];
  },
  
  async updateRating(userId, delta) {
    await pool.query(
      'UPDATE users SET rating = rating + $1 WHERE user_id = $2',
      [delta, userId]
    );
  },
  
  // Стикеры
  async saveSticker(sticker) {
    const result = await pool.query(
      `INSERT INTO stickers 
       (user_id, file_id, file_unique_id, effect, frame, has_text, text_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (file_id) DO NOTHING
       RETURNING *`,
      [
        sticker.userId,
        sticker.fileId,
        sticker.fileUniqueId,
        sticker.effect || 'none',
        sticker.frame || 'none',
        !!sticker.text,
        sticker.text || null
      ]
    );
    
    // Обновляем счетчик пользователя
    if (result.rows[0]) {
      await pool.query(
        'UPDATE users SET stickers_created = stickers_created + 1 WHERE user_id = $1',
        [sticker.userId]
      );
    }
    
    return result.rows[0];
  },
  
  async getTopStickers(limit = 15) {
    const result = await pool.query(`
      SELECT s.*, u.username, u.first_name,
             (s.likes * 100.0 / GREATEST(s.views, 1)) as rating_percent
      FROM stickers s
      JOIN users u ON s.user_id = u.user_id
      ORDER BY s.likes DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  },
  
  async getTopUsers(limit = 10) {
    const result = await pool.query(`
      SELECT u.*, COUNT(s.id) as sticker_count,
             COALESCE(SUM(s.likes), 0) as total_likes
      FROM users u
      LEFT JOIN stickers s ON u.user_id = s.user_id
      GROUP BY u.user_id
      ORDER BY u.rating DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  },
  
  // Голосование
  async addVote(userId, stickerId, voteType) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Удаляем старый голос
      await client.query(
        'DELETE FROM votes WHERE user_id = $1 AND sticker_id = $2',
        [userId, stickerId]
      );
      
      // Добавляем новый
      await client.query(
        'INSERT INTO votes (user_id, sticker_id, vote_type) VALUES ($1, $2, $3)',
        [userId, stickerId, voteType]
      );
      
      // Обновляем счетчик
      if (voteType === 'like') {
        await client.query(
          'UPDATE stickers SET likes = likes + 1 WHERE id = $1',
          [stickerId]
        );
        // +5 рейтинга автору
        await client.query(
          `UPDATE users SET rating = rating + 5 
           WHERE user_id = (SELECT user_id FROM stickers WHERE id = $1)`,
          [stickerId]
        );
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Vote error:', error);
      return false;
    } finally {
      client.release();
    }
  },
  
  // Статистика
  async getUserStats(userId) {
    const result = await pool.query(`
      SELECT 
        u.*,
        COUNT(s.id) as stickers_created,
        COALESCE(SUM(s.likes), 0) as total_likes,
        COALESCE(AVG(s.likes), 0) as avg_likes
      FROM users u
      LEFT JOIN stickers s ON u.user_id = s.user_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `, [userId]);
    return result.rows[0];
  }
};
