const { Pool } = require('pg');
const cache = require('./cache');

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: parseInt(process.env.DB_POOL_MAX) || 2,
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 10000
    });
    
    this.initialized = false;
  }
  
  async init() {
    if (this.initialized) return;
    
    try {
      await this.pool.query(`
        -- Пользователи
        CREATE TABLE IF NOT EXISTS users (
          user_id BIGINT PRIMARY KEY,
          username VARCHAR(255),
          first_name VARCHAR(255),
          last_name VARCHAR(255),
          rating INTEGER DEFAULT 100,
          coins INTEGER DEFAULT 0,
          stickers_created INTEGER DEFAULT 0,
          total_likes INTEGER DEFAULT 0,
          level INTEGER DEFAULT 1,
          xp INTEGER DEFAULT 0,
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          achievements TEXT[] DEFAULT '{}'
        );
        
        -- Стикеры
        CREATE TABLE IF NOT EXISTS stickers (
          id SERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
          file_id VARCHAR(255) UNIQUE,
          file_unique_id VARCHAR(255) UNIQUE,
          effect VARCHAR(50),
          frame VARCHAR(50),
          has_text BOOLEAN DEFAULT FALSE,
          text_content TEXT,
          likes INTEGER DEFAULT 0,
          views INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          tags VARCHAR(255)[]
        );
        
        -- Голоса
        CREATE TABLE IF NOT EXISTS votes (
          id SERIAL PRIMARY KEY,
          user_id BIGINT,
          sticker_id INTEGER REFERENCES stickers(id) ON DELETE CASCADE,
          vote_type VARCHAR(10) CHECK (vote_type IN ('like', 'dislike')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, sticker_id)
        );
        
        -- Ежедневные награды
        CREATE TABLE IF NOT EXISTS daily_rewards (
          user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
          last_reward_date DATE,
          streak INTEGER DEFAULT 0,
          total_rewards INTEGER DEFAULT 0
        );
        
        -- Статистика
        CREATE TABLE IF NOT EXISTS statistics (
          id SERIAL PRIMARY KEY,
          date DATE DEFAULT CURRENT_DATE,
          total_users INTEGER DEFAULT 0,
          total_stickers INTEGER DEFAULT 0,
          total_likes INTEGER DEFAULT 0,
          active_users INTEGER DEFAULT 0
        );
        
        -- Индексы для производительности
        CREATE INDEX IF NOT EXISTS idx_stickers_user_id ON stickers(user_id);
        CREATE INDEX IF NOT EXISTS idx_stickers_created_at ON stickers(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_stickers_likes ON stickers(likes DESC);
        CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
        CREATE INDEX IF NOT EXISTS idx_votes_user_sticker ON votes(user_id, sticker_id);
        CREATE INDEX IF NOT EXISTS idx_votes_sticker ON votes(sticker_id);
        
        -- Материализованное представление для трендов
        CREATE MATERIALIZED VIEW IF NOT EXISTS trending_stickers AS
        SELECT 
          s.*,
          u.username,
          u.first_name,
          (s.likes * 2.0 + s.views * 0.5) / 
          (EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 3600 + 2) ^ 1.8 as trend_score
        FROM stickers s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.created_at > NOW() - INTERVAL '7 days'
        ORDER BY trend_score DESC
        LIMIT 20;
        
        -- Обновление материализованного представления
        REFRESH MATERIALIZED VIEW trending_stickers;
      `);
      
      this.initialized = true;
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      throw error;
    }
  }
  
  // ===== ПОЛЬЗОВАТЕЛИ =====
  async getUser(userId) {
    const cached = cache.getUser(userId);
    if (cached) return cached;
    
    const result = await this.pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows[0]) {
      cache.setUser(userId, result.rows[0]);
    }
    
    return result.rows[0];
  }
  
  async createUser(userData) {
    const result = await this.pool.query(
      `INSERT INTO users (user_id, username, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       last_active = CURRENT_TIMESTAMP
       RETURNING *`,
      [userData.id, userData.username, userData.first_name, userData.last_name]
    );
    
    cache.setUser(userData.id, result.rows[0]);
    return result.rows[0];
  }
  
  async updateUserRating(userId, delta) {
    const result = await this.pool.query(
      `UPDATE users 
       SET rating = rating + $1,
           last_active = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING rating`,
      [delta, userId]
    );
    
    cache.del(`user:${userId}`);
    return result.rows[0]?.rating || 0;
  }
  
  async incrementUserStats(userId, field, value = 1) {
    await this.pool.query(
      `UPDATE users 
       SET ${field} = ${field} + $1,
           last_active = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [value, userId]
    );
    
    cache.del(`user:${userId}`);
  }
  
  // ===== СТИКЕРЫ =====
  async saveSticker(stickerData) {
    const result = await this.pool.query(
      `INSERT INTO stickers 
       (user_id, file_id, file_unique_id, effect, frame, has_text, text_content, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (file_id) DO NOTHING
       RETURNING *`,
      [
        stickerData.userId,
        stickerData.fileId,
        stickerData.fileUniqueId || `sticker_${Date.now()}`,
        stickerData.effect || 'none',
        stickerData.frame || 'none',
        !!stickerData.text,
        stickerData.text || null,
        stickerData.tags || []
      ]
    );
    
    if (result.rows[0]) {
      // Обновляем счетчик пользователя
      await this.incrementUserStats(stickerData.userId, 'stickers_created');
      
      // Обновляем кэш топа
      cache.del('top:stickers');
      cache.del('trending');
    }
    
    return result.rows[0];
  }
  
  async getSticker(fileId) {
    const cached = cache.getSticker(fileId);
    if (cached) return cached;
    
    const result = await this.pool.query(
      'SELECT * FROM stickers WHERE file_id = $1',
      [fileId]
    );
    
    if (result.rows[0]) {
      cache.setSticker(fileId, result.rows[0]);
    }
    
    return result.rows[0];
  }
  
  async getStickerById(id) {
    const result = await this.pool.query(
      'SELECT * FROM stickers WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }
  
  async incrementStickerViews(fileId) {
    await this.pool.query(
      'UPDATE stickers SET views = views + 1 WHERE file_id = $1',
      [fileId]
    );
    
    cache.del(`sticker:${fileId}`);
  }
  
  // ===== ГОЛОСОВАНИЕ =====
  async addVote(userId, stickerId, voteType) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Проверяем существующий голос
      const existingVote = await client.query(
        'SELECT vote_type FROM votes WHERE user_id = $1 AND sticker_id = $2',
        [userId, stickerId]
      );
      
      let ratingChange = 0;
      
      if (existingVote.rows.length > 0) {
        const oldVoteType = existingVote.rows[0].vote_type;
        
        // Удаляем старый голос
        if (oldVoteType === 'like') {
          await client.query(
            'UPDATE stickers SET likes = likes - 1 WHERE id = $1',
            [stickerId]
          );
          ratingChange -= 5;
        } else if (oldVoteType === 'dislike') {
          await client.query(
            'UPDATE stickers SET dislikes = dislikes - 1 WHERE id = $1',
            [stickerId]
          );
        }
        
        // Обновляем голос
        await client.query(
          'UPDATE votes SET vote_type = $1, created_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND sticker_id = $3',
          [voteType, userId, stickerId]
        );
      } else {
        // Новый голос
        await client.query(
          'INSERT INTO votes (user_id, sticker_id, vote_type) VALUES ($1, $2, $3)',
          [userId, stickerId, voteType]
        );
      }
      
      // Обновляем счетчик стикера
      if (voteType === 'like') {
        await client.query(
          'UPDATE stickers SET likes = likes + 1 WHERE id = $1',
          [stickerId]
        );
        ratingChange += 5;
      } else if (voteType === 'dislike') {
        await client.query(
          'UPDATE stickers SET dislikes = dislikes + 1 WHERE id = $1',
          [stickerId]
        );
        ratingChange -= 2;
      }
      
      // Обновляем рейтинг автора
      if (ratingChange !== 0) {
        const sticker = await client.query(
          'SELECT user_id FROM stickers WHERE id = $1',
          [stickerId]
        );
        
        if (sticker.rows[0]) {
          await client.query(
            'UPDATE users SET rating = rating + $1 WHERE user_id = $2',
            [ratingChange, sticker.rows[0].user_id]
          );
          cache.del(`user:${sticker.rows[0].user_id}`);
        }
      }
      
      await client.query('COMMIT');
      
      // Очищаем кэши
      const sticker = await this.getStickerById(stickerId);
      if (sticker) {
        cache.del(`sticker:${sticker.file_id}`);
      }
      cache.del('top:stickers');
      cache.del('trending');
      
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Vote transaction error:', error);
      return false;
    } finally {
      client.release();
    }
  }
  
  // ===== ТОПЫ И СТАТИСТИКА =====
  async getTopStickers(limit = 10) {
    return cache.memoize('top:stickers', async () => {
      const result = await this.pool.query(`
        SELECT s.*, u.username, u.first_name,
               (s.likes * 100.0 / NULLIF(s.views, 0)) as popularity
        FROM stickers s
        JOIN users u ON s.user_id = u.user_id
        ORDER BY s.likes DESC, s.created_at DESC
        LIMIT $1
      `, [limit]);
      return result.rows;
    }, 60);
  }
  
  async getTopUsers(limit = 10) {
    const result = await this.pool.query(`
      SELECT u.*, 
             COUNT(s.id) as sticker_count,
             COALESCE(SUM(s.likes), 0) as total_likes,
             RANK() OVER (ORDER BY u.rating DESC) as rank
      FROM users u
      LEFT JOIN stickers s ON u.user_id = s.user_id
      GROUP BY u.user_id
      ORDER BY u.rating DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }
  
  async getTrendingStickers(limit = 10) {
    return cache.memoize('trending', async () => {
      const result = await this.pool.query(`
        SELECT * FROM trending_stickers
        LIMIT $1
      `, [limit]);
      return result.rows;
    }, 120);
  }
  
  async getUserStats(userId) {
    const result = await this.pool.query(`
      SELECT 
        u.*,
        COUNT(s.id) as stickers_created,
        COALESCE(SUM(s.likes), 0) as total_likes,
        COALESCE(AVG(s.likes), 0) as avg_likes,
        (SELECT COUNT(*) FROM votes v 
         JOIN stickers s2 ON v.sticker_id = s2.id 
         WHERE s2.user_id = u.user_id) as total_votes
      FROM users u
      LEFT JOIN stickers s ON u.user_id = s.user_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `, [userId]);
    return result.rows[0];
  }
  
  async getUserRank(userId) {
    const result = await this.pool.query(`
      SELECT rank FROM (
        SELECT user_id, ROW_NUMBER() OVER (ORDER BY rating DESC) as rank
        FROM users
      ) ranked_users
      WHERE user_id = $1
    `, [userId]);
    return result.rows[0]?.rank || 0;
  }
  
  // ===== АДМИНИСТРАЦИЯ =====
  async getBotStats() {
    const result = await this.pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM stickers) as total_stickers,
        (SELECT COUNT(*) FROM votes) as total_votes,
        (SELECT COUNT(*) FROM users WHERE last_active > NOW() - INTERVAL '1 day') as daily_active_users,
        (SELECT SUM(likes) FROM stickers) as total_likes
    `);
    return result.rows[0];
  }
  
  // Очистка старых данных
  async cleanupOldSessions() {
    await this.pool.query(`
      DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '7 days'
    `);
  }
}

module.exports = new Database();
