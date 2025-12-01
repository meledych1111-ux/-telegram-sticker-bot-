const { Pool } = require('pg');

console.log('Initializing database connection...');

// Проверяем наличие DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL not set. Database functions will be disabled.');
  
  // Возвращаем заглушки вместо реальных функций
  module.exports = {
    saveUser: async () => { console.log('DB: saveUser (stub)'); },
    saveSticker: async () => { 
      console.log('DB: saveSticker (stub)');
      return Math.floor(Math.random() * 1000); // возвращаем fake ID
    },
    addView: async () => { console.log('DB: addView (stub)'); },
    vote: async () => { 
      console.log('DB: vote (stub)');
      return 'success'; 
    },
    getStickerStats: async () => {
      console.log('DB: getStickerStats (stub)');
      return { likes: 0, dislikes: 0, views: 0, rating_percent: 0 };
    },
    getTopStickers: async () => {
      console.log('DB: getTopStickers (stub)');
      return [];
    },
    getUserStats: async () => {
      console.log('DB: getUserStats (stub)');
      return { stickers_count: 0, total_likes: 0, total_views: 0, total_stickers: 0 };
    }
  };
  return;
}

// Если DATABASE_URL есть, создаем реальное подключение
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

// Инициализация базы
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username VARCHAR(100),
        first_name VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        stickers_count INT DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(300) UNIQUE,
        user_id BIGINT,
        emoji VARCHAR(10) DEFAULT '😀',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        likes INT DEFAULT 0,
        dislikes INT DEFAULT 0,
        views INT DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        sticker_id INT,
        user_id BIGINT,
        vote INT CHECK (vote IN (1, -1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sticker_id, user_id)
      );
    `);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database init error:', error.message);
  } finally {
    client.release();
  }
}

initDatabase();

// Реальные функции базы данных
module.exports = {
  pool,
  
  async saveUser(userId, username, firstName) {
    try {
      await pool.query(`
        INSERT INTO users (user_id, username, first_name) 
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name
      `, [userId, username || '', firstName || '']);
    } catch (error) {
      console.error('Error saving user:', error.message);
    }
  },

  async saveSticker(fileId, userId, emoji = '😀') {
    try {
      const result = await pool.query(`
        INSERT INTO stickers (file_id, user_id, emoji) 
        VALUES ($1, $2, $3)
        ON CONFLICT (file_id) DO NOTHING
        RETURNING id
      `, [fileId, userId, emoji]);

      if (result.rows[0]) {
        await pool.query(`
          UPDATE users 
          SET stickers_count = stickers_count + 1 
          WHERE user_id = $1
        `, [userId]);
        return result.rows[0].id;
      }
      return null;
    } catch (error) {
      console.error('Error saving sticker:', error.message);
      return null;
    }
  },

  async addView(stickerId) {
    try {
      await pool.query(`
        UPDATE stickers 
        SET views = views + 1 
        WHERE id = $1
      `, [stickerId]);
    } catch (error) {
      console.error('Error adding view:', error.message);
    }
  },

  async vote(stickerId, userId, voteType) {
    try {
      const voteValue = voteType === 'like' ? 1 : -1;
      // ... остальной код голосования
      return 'success';
    } catch (error) {
      console.error('Error voting:', error.message);
      return 'error';
    }
  },

  async getStickerStats(stickerId) {
    try {
      const result = await pool.query(`
        SELECT 
          likes,
          dislikes,
          views,
          CASE 
            WHEN (likes + dislikes) > 0 
            THEN ROUND((likes * 100.0 / (likes + dislikes)), 1)
            ELSE 0 
          END as rating_percent
        FROM stickers 
        WHERE id = $1
      `, [stickerId]);
      
      return result.rows[0] || { likes: 0, dislikes: 0, views: 0, rating_percent: 0 };
    } catch (error) {
      console.error('Error getting stats:', error.message);
      return { likes: 0, dislikes: 0, views: 0, rating_percent: 0 };
    }
  },

  async getTopStickers(limit = 10) {
    try {
      const result = await pool.query(`
        SELECT 
          s.id,
          s.file_id,
          s.emoji,
          s.likes,
          s.dislikes,
          s.views,
          u.username,
          u.first_name,
          CASE 
            WHEN (s.likes + s.dislikes) > 0 
            THEN ROUND((s.likes * 100.0 / (s.likes + s.dislikes)), 1)
            ELSE 0 
          END as rating
        FROM stickers s
        LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.likes + s.dislikes >= 1
        ORDER BY rating DESC, s.likes DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting top:', error.message);
      return [];
    }
  },

  async getUserStats(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          u.stickers_count,
          COALESCE(SUM(s.likes), 0) as total_likes,
          COALESCE(SUM(s.views), 0) as total_views,
          COUNT(s.id) as total_stickers
        FROM users u
        LEFT JOIN stickers s ON u.user_id = s.user_id
        WHERE u.user_id = $1
        GROUP BY u.user_id, u.stickers_count
      `, [userId]);
      
      return result.rows[0] || { stickers_count: 0, total_likes: 0, total_views: 0, total_stickers: 0 };
    } catch (error) {
      console.error('Error getting user stats:', error.message);
      return { stickers_count: 0, total_likes: 0, total_views: 0, total_stickers: 0 };
    }
  }
};
