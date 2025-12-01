const { Pool } = require('pg');

// Подключение к Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Проверка соединения
async function checkConnection() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Соединение с БД установлено');
    return true;
  } catch (error) {
    console.error('❌ Нет соединения с БД:', error.message);
    return false;
  }
}

// Инициализация таблиц
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        telegram_file_id VARCHAR(255),
        file_unique_id VARCHAR(255),
        width INTEGER,
        height INTEGER,
        file_size INTEGER,
        has_frame BOOLEAN DEFAULT false,
        frame_color VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Таблицы БД инициализированы');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
  }
}

// Получить/создать пользователя
async function getOrCreateUser(telegramUser) {
  try {
    const result = await pool.query(`
      INSERT INTO users (telegram_id, username, first_name)
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_id) DO NOTHING
      RETURNING *
    `, [
      telegramUser.id,
      telegramUser.username,
      telegramUser.first_name
    ]);
    
    return result.rows[0] || { id: 1 };
  } catch (error) {
    console.error('❌ Ошибка getOrCreateUser:', error.message);
    return { id: 1 };
  }
}

// Сохранить стикер
async function saveSticker(stickerData) {
  try {
    const result = await pool.query(`
      INSERT INTO stickers (
        user_id, telegram_file_id, file_unique_id,
        width, height, file_size, has_frame, frame_color
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      stickerData.user_id,
      stickerData.telegram_file_id,
      stickerData.file_unique_id,
      stickerData.width,
      stickerData.height,
      stickerData.file_size,
      stickerData.has_frame,
      stickerData.frame_color
    ]);
    
    return result.rows[0] || { id: 1 };
  } catch (error) {
    console.error('❌ Ошибка saveSticker:', error.message);
    return { id: 1 };
  }
}

// Получить статистику
async function getStats(telegramId) {
  try {
    const result = await pool.query(`
      SELECT 
        u.*,
        COUNT(s.id) as stickers_created
      FROM users u
      LEFT JOIN stickers s ON u.id = s.user_id
      WHERE u.telegram_id = $1
      GROUP BY u.id
    `, [telegramId]);
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка getStats:', error.message);
    return null;
  }
}

// Инициализируем БД при импорте
initDatabase();

module.exports = {
  pool,
  checkConnection,
  getOrCreateUser,
  saveSticker,
  getStats
};
