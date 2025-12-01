import postgres from 'postgres';
import { nanoid } from 'nanoid';
import logger from './logger.js';

// Конфигурация подключения
const neonUrl = process.env.NEON_DATABASE_URL;

if (!neonUrl) {
  console.warn('⚠️  NEON_DATABASE_URL не настроен. База данных отключена.');
}

let sql = null;

// Инициализация подключения
export async function initDatabase() {
  if (!neonUrl) return null;
  
  try {
    sql = postgres(neonUrl, {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10
    });
    
    await sql`SELECT 1`;
    await logger.info('✅ Подключение к Neon PostgreSQL установлено');
    
    // Создаем таблицы если их нет
    await createTables();
    
    return sql;
  } catch (error) {
    await logger.error(`❌ Ошибка подключения к БД: ${error.message}`);
    return null;
  }
}

// Создание таблиц
async function createTables() {
  if (!sql) return;
  
  try {
    // Таблица пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Таблица стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id VARCHAR(21) PRIMARY KEY DEFAULT ${nanoid()},
        user_id INTEGER REFERENCES users(id),
        telegram_file_id VARCHAR(255),
        file_unique_id VARCHAR(255),
        file_size INTEGER,
        effect VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE
      )
    `;
    
    // Таблица статистики
    await sql`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id INTEGER PRIMARY KEY REFERENCES users(id),
        stickers_created INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await logger.info('✅ Таблицы базы данных созданы/проверены');
  } catch (error) {
    await logger.error(`❌ Ошибка создания таблиц: ${error.message}`);
  }
}

// Получить или создать пользователя
export async function getOrCreateUser(telegramUser) {
  if (!sql) {
    return {
      id: 1,
      telegram_id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name
    };
  }
  
  try {
    let user = await sql`
      SELECT * FROM users WHERE telegram_id = ${telegramUser.id}
    `.then(rows => rows[0]);
    
    if (!user) {
      user = await sql`
        INSERT INTO users (telegram_id, username, first_name, last_name)
        VALUES (${telegramUser.id}, ${telegramUser.username}, 
                ${telegramUser.first_name}, ${telegramUser.last_name})
        RETURNING *
      `.then(rows => rows[0]);
      
      // Создаем запись статистики
      await sql`
        INSERT INTO user_stats (user_id)
        VALUES (${user.id})
        ON CONFLICT (user_id) DO NOTHING
      `;
      
      await logger.info(`👤 Новый пользователь: ${telegramUser.id} (@${telegramUser.username || 'no-username'})`);
    }
    
    return user;
  } catch (error) {
    await logger.error(`❌ Ошибка getOrCreateUser: ${error.message}`);
    throw error;
  }
}

// Сохранить стикер
export async function saveSticker(stickerData) {
  if (!sql) {
    return { id: 'mock-' + Date.now() };
  }
  
  try {
    const sticker = await sql`
      INSERT INTO stickers (user_id, telegram_file_id, file_unique_id, file_size)
      VALUES (${stickerData.user_id}, ${stickerData.telegram_file_id},
              ${stickerData.file_unique_id}, ${stickerData.file_size})
      RETURNING id
    `.then(rows => rows[0]);
    
    // Обновляем статистику
    await sql`
      UPDATE user_stats 
      SET stickers_created = stickers_created + 1,
          last_activity = CURRENT_TIMESTAMP
      WHERE user_id = ${stickerData.user_id}
    `;
    
    await logger.info(`💾 Стикер сохранен: ${sticker.id}`);
    return sticker;
  } catch (error) {
    await logger.error(`❌ Ошибка saveSticker: ${error.message}`);
    throw error;
  }
}

// Получить статистику пользователя
export async function getStats(telegramId) {
  if (!sql) {
    return { stickers_created: 0 };
  }
  
  try {
    const stats = await sql`
      SELECT us.stickers_created, us.last_activity
      FROM user_stats us
      JOIN users u ON u.id = us.user_id
      WHERE u.telegram_id = ${telegramId}
    `.then(rows => rows[0]);
    
    return stats || { stickers_created: 0 };
  } catch (error) {
    await logger.error(`❌ Ошибка getStats: ${error.message}`);
    return { stickers_created: 0 };
  }
}

// Закрыть соединение
export async function closeDatabase() {
  if (sql) {
    await sql.end();
    await logger.info('🔌 Соединение с БД закрыто');
  }
}

// Инициализируем при импорте
await initDatabase();

// Экспорт по умолчанию
export default {
  initDatabase,
  getOrCreateUser,
  saveSticker,
  getStats,
  closeDatabase
};
