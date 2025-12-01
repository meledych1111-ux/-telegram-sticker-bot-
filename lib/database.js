const { Pool } = require('pg');

// Подключение к Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Проверка подключения
pool.on('connect', () => {
  console.log('✅ Подключение к базе данных установлено');
});

pool.on('error', (err) => {
  console.error('❌ Ошибка подключения к БД:', err);
});

// Инициализация таблиц
async function initDatabase() {
  try {
    console.log('🔄 Инициализация базы данных...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        stickers_count INTEGER DEFAULT 0,
        rating INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        folder_id INTEGER REFERENCES folders(id),
        image_data BYTEA NOT NULL,
        effect_type VARCHAR(50),
        text_overlay TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Таблицы созданы/проверены');
    return true;
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    throw error;
  }
}

// Получить или создать пользователя
async function getUser(telegramId, username) {
  try {
    // Проверяем существование пользователя
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    
    if (existingUser.rows.length > 0) {
      // Обновляем username если изменился
      if (username && existingUser.rows[0].username !== username) {
        await pool.query(
          'UPDATE users SET username = $1 WHERE telegram_id = $2',
          [username, telegramId]
        );
      }
      return existingUser.rows[0];
    }
    
    // Создаем нового пользователя
    const newUser = await pool.query(
      `INSERT INTO users (telegram_id, username) 
       VALUES ($1, $2) 
       RETURNING *`,
      [telegramId, username]
    );
    
    console.log(`👤 Новый пользователь: ${username} (${telegramId})`);
    return newUser.rows[0];
  } catch (error) {
    console.error('❌ Ошибка getUser:', error);
    throw error;
  }
}

// Сохранить стикер
async function saveSticker(telegramId, imageBuffer, effectType, textOverlay) {
  try {
    // Получаем ID пользователя
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('Пользователь не найден');
    }
    
    const userId = userResult.rows[0].id;
    
    // Сохраняем стикер
    const stickerResult = await pool.query(
      `INSERT INTO stickers (user_id, image_data, effect_type, text_overlay)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, imageBuffer, effectType, textOverlay]
    );
    
    const stickerId = stickerResult.rows[0].id;
    console.log(`✅ Стикер сохранен: ID ${stickerId}, эффект: ${effectType}`);
    return stickerId;
  } catch (error) {
    console.error('❌ Ошибка saveSticker:', error);
    throw error;
  }
}

// Получить стикеры пользователя
async function getUserStickers(telegramId) {
  try {
    const result = await pool.query(
      `SELECT s.* FROM stickers s
       JOIN users u ON s.user_id = u.id
       WHERE u.telegram_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [telegramId]
    );
    
    console.log(`📚 Загружено ${result.rows.length} стикеров для ${telegramId}`);
    return result.rows;
  } catch (error) {
    console.error('❌ Ошибка getUserStickers:', error);
    return [];
  }
}

// Создать папку
async function createFolder(telegramId, name) {
  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('Пользователь не найден');
    }
    
    const userId = userResult.rows[0].id;
    
    const folderResult = await pool.query(
      `INSERT INTO folders (user_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, name]
    );
    
    console.log(`📂 Папка создана: "${name}" для ${telegramId}`);
    return folderResult.rows[0];
  } catch (error) {
    console.error('❌ Ошибка createFolder:', error);
    throw error;
  }
}

// Получить папки пользователя
async function getFolders(telegramId) {
  try {
    const result = await pool.query(
      `SELECT f.* FROM folders f
       JOIN users u ON f.user_id = u.id
       WHERE u.telegram_id = $1
       ORDER BY f.created_at DESC`,
      [telegramId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('❌ Ошибка getFolders:', error);
    return [];
  }
}

// Получить статистику
async function getStats(telegramId) {
  try {
    const result = await pool.query(
      `SELECT 
        u.username,
        u.stickers_count,
        u.rating,
        u.created_at,
        COALESCE(COUNT(DISTINCT f.id), 0) as folders_count
       FROM users u
       LEFT JOIN folders f ON u.id = f.user_id
       WHERE u.telegram_id = $1
       GROUP BY u.id`,
      [telegramId]
    );
    
    return result.rows[0] || {
      username: 'Пользователь',
      stickers_count: 0,
      rating: 5,
      created_at: new Date(),
      folders_count: 0
    };
  } catch (error) {
    console.error('❌ Ошибка getStats:', error);
    return {
      username: 'Ошибка',
      stickers_count: 0,
      rating: 0,
      created_at: new Date(),
      folders_count: 0
    };
  }
}

// Обновить статистику
async function updateStats(telegramId) {
  try {
    // Считаем стикеры
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM stickers s
       JOIN users u ON s.user_id = u.id
       WHERE u.telegram_id = $1`,
      [telegramId]
    );
    
    const stickerCount = parseInt(countResult.rows[0].count);
    const newRating = Math.min(10, 5 + Math.floor(stickerCount / 10));
    
    // Обновляем
    await pool.query(
      `UPDATE users 
       SET stickers_count = $1, rating = $2
       WHERE telegram_id = $3`,
      [stickerCount, newRating, telegramId]
    );
    
    console.log(`📊 Статистика обновлена: ${stickerCount} стикеров, рейтинг: ${newRating}`);
  } catch (error) {
    console.error('❌ Ошибка updateStats:', error);
  }
}

// Для получения топ пользователей
async function getTopUsers(limit = 10) {
  try {
    const result = await pool.query(
      `SELECT username, stickers_count, rating
       FROM users
       ORDER BY stickers_count DESC, rating DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('❌ Ошибка getTopUsers:', error);
    return [];
  }
}

module.exports = {
  initDatabase,
  getUser,
  saveSticker,
  getUserStickers,
  createFolder,
  getFolders,
  getStats,
  updateStats,
  getTopUsers,
  pool
};
