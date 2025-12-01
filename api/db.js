const { Pool } = require('pg');

// Подключение к Neon PostgreSQL (бесплатный тариф)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 3, // Минимум соединений для бесплатного тарифа
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Простая инициализация базы
const initDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Пользователи
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username VARCHAR(100),
        first_name VARCHAR(200),
        stickers_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Стикеры
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        file_id VARCHAR(300) UNIQUE,
        user_id BIGINT,
        emoji VARCHAR(10),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        likes INT DEFAULT 0,
        dislikes INT DEFAULT 0,
        views INT DEFAULT 0
      );
      
      -- Лайки/дизлайки
      CREATE TABLE IF NOT EXISTS votes (
        id SERIAL PRIMARY KEY,
        sticker_id INT,
        user_id BIGINT,
        vote SMALLINT CHECK (vote IN (1, -1)),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sticker_id, user_id)
      );
      
      -- Топ стикеров (материализованное представление для оптимизации)
      CREATE TABLE IF NOT EXISTS top_stickers (
        sticker_id INT PRIMARY KEY,
        score FLOAT DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Создаем индексы
      CREATE INDEX IF NOT EXISTS idx_stickers_user ON stickers(user_id);
      CREATE INDEX IF NOT EXISTS idx_stickers_created ON stickers(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
      CREATE INDEX IF NOT EXISTS idx_votes_sticker ON votes(sticker_id);
      
    `);
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  } finally {
    client.release();
  }
};

// Вызываем инициализацию
initDatabase();

const db = {
  // Сохраняем пользователя
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
      console.error('Error saving user:', error);
    }
  },

  // Сохраняем стикер
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
      }
      return result.rows[0]?.id;
    } catch (error) {
      console.error('Error saving sticker:', error);
      return null;
    }
  },

  // Добавляем просмотр
  async addView(stickerId) {
    try {
      await pool.query(`
        UPDATE stickers 
        SET views = views + 1 
        WHERE id = $1
      `, [stickerId]);
    } catch (error) {
      console.error('Error adding view:', error);
    }
  },

  // Голосование
  async vote(stickerId, userId, voteType) {
    try {
      const voteValue = voteType === 'like' ? 1 : -1;
      
      const existing = await pool.query(
        'SELECT vote FROM votes WHERE sticker_id = $1 AND user_id = $2',
        [stickerId, userId]
      );

      if (existing.rows[0]) {
        const oldVote = existing.rows[0].vote;
        if (oldVote === voteValue) {
          return 'already_voted';
        }
        
        // Удаляем старый голос
        await pool.query(
          'DELETE FROM votes WHERE sticker_id = $1 AND user_id = $2',
          [stickerId, userId]
        );
        
        // Обновляем счетчики
        if (oldVote === 1) {
          await pool.query(
            'UPDATE stickers SET likes = likes - 1 WHERE id = $1',
            [stickerId]
          );
        } else {
          await pool.query(
            'UPDATE stickers SET dislikes = dislikes - 1 WHERE id = $1',
            [stickerId]
          );
        }
      }

      // Добавляем новый голос
      await pool.query(`
        INSERT INTO votes (sticker_id, user_id, vote)
        VALUES ($1, $2, $3)
      `, [stickerId, userId, voteValue]);

      // Обновляем счетчики стикера
      if (voteValue === 1) {
        await pool.query(
          'UPDATE stickers SET likes = likes + 1 WHERE id = $1',
          [stickerId]
        );
      } else {
        await pool.query(
          'UPDATE stickers SET dislikes = dislikes + 1 WHERE id = $1',
          [stickerId]
        );
      }

      return 'success';
    } catch (error) {
      console.error('Error voting:', error);
      return 'error';
    }
  },

  // Получаем статистику стикера
  async getStickerStats(stickerId) {
    try {
      const result = await pool.query(`
        SELECT 
          likes,
          dislikes,
          views,
          ROUND(
            CASE 
              WHEN (likes + dislikes) > 0 
              THEN (likes * 1.0 / (likes + dislikes)) * 100 
              ELSE 0 
            END, 1
          ) as rating_percent
        FROM stickers 
        WHERE id = $1
      `, [stickerId]);
      
      return result.rows[0] || { likes: 0, dislikes: 0, views: 0, rating_percent: 0 };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { likes: 0, dislikes: 0, views: 0, rating_percent: 0 };
    }
  },

  // Топ стикеров
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
            THEN (s.likes * 1.0 / (s.likes + s.dislikes)) * 100 
            ELSE 0 
          END as rating
        FROM stickers s
        LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.likes + s.dislikes >= 3
        ORDER BY rating DESC, s.likes DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting top stickers:', error);
      return [];
    }
  },

  // Статистика пользователя
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
      console.error('Error getting user stats:', error);
      return { stickers_count: 0, total_likes: 0, total_views: 0, total_stickers: 0 };
    }
  }
};

module.exports = db;
