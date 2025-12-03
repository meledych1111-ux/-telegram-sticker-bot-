// lib/database.js - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ
const { neon } = require('@neondatabase/serverless');

// Подключение к Neon PostgreSQL
let sql;
try {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не установлен');
  }
  sql = neon(process.env.DATABASE_URL);
  console.log('✅ Neon PostgreSQL подключен');
} catch (error) {
  console.error('❌ Ошибка подключения к Neon:', error.message);
  sql = null;
}

// 🗄️ Инициализация таблиц
async function initializeTables() {
  if (!sql) {
    console.log('⚠️ База данных не подключена, пропускаем инициализацию');
    return;
  }
  
  try {
    // Таблица пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        language_code VARCHAR(10),
        registration_date TIMESTAMP DEFAULT NOW(),
        last_activity TIMESTAMP DEFAULT NOW(),
        stickers_created INT DEFAULT 0,
        premium BOOLEAN DEFAULT FALSE,
        is_bot BOOLEAN DEFAULT FALSE
      )
    `;

    // Таблица стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        original_format VARCHAR(50) DEFAULT 'photo',
        sticker_size INT DEFAULT 0,
        processing_time FLOAT DEFAULT 0,
        effect_applied VARCHAR(100) DEFAULT 'none',
        file_id VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Таблица подборок
    await sql`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        sticker_count INT DEFAULT 0,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Таблица связей стикеров и подборок
    await sql`
      CREATE TABLE IF NOT EXISTS collection_stickers (
        collection_id INT REFERENCES collections(id) ON DELETE CASCADE,
        sticker_id INT REFERENCES stickers(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (collection_id, sticker_id)
      )
    `;

    console.log('✅ Таблицы базы данных готовы');
  } catch (error) {
    console.error('❌ Ошибка инициализации таблиц:', error.message);
  }
}

// 👤 Регистрация/обновление пользователя
async function saveUser(chatId, username, firstName) {
  if (!sql) {
    console.log('⚠️ База данных не подключена, пропускаем saveUser');
    return null;
  }
  
  try {
    const result = await sql`
      INSERT INTO users (
        chat_id, username, first_name, last_activity
      ) 
      VALUES (
        ${chatId}, ${username || ''}, ${firstName || ''}, NOW()
      )
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_activity = NOW()
      RETURNING id
    `;

    console.log(`✅ Пользователь сохранен: ${username || chatId}`);
    return result[0]?.id;
  } catch (error) {
    console.error('❌ Ошибка сохранения пользователя:', error.message);
    return null;
  }
}

// 🎨 Сохранить информацию о стикере
async function saveSticker(chatId, fileId, effect = 'none', sizeBytes = 0) {
  if (!sql) {
    console.log('⚠️ База данных не подключена, пропускаем saveSticker');
    return false;
  }
  
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO stickers (
          user_id, effect_applied, file_id, sticker_size
        )
        VALUES (
          ${user[0].id}, ${effect}, ${fileId}, ${sizeBytes}
        )
      `;
      
      // Увеличиваем счетчик стикеров у пользователя
      await sql`
        UPDATE users 
        SET stickers_created = stickers_created + 1,
            last_activity = NOW()
        WHERE id = ${user[0].id}
      `;
      
      console.log(`✅ Стикер сохранен с эффектом: ${effect}, file_id: ${fileId.substring(0, 20)}...`);
      return true;
    } else {
      console.log(`❌ Пользователь ${chatId} не найден в базе`);
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения стикера:', error.message);
    return false;
  }
}

// 📊 Получить статистику пользователя
async function getUserStats(chatId) {
  if (!sql) {
    console.log('⚠️ База данных не подключена, возвращаем тестовые данные');
    return {
      username: 'Гость',
      total_stickers: 0,
      registration_date: new Date()
    };
  }
  
  try {
    const user = await sql`
      SELECT 
        username,
        first_name,
        stickers_created,
        registration_date
      FROM users 
      WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return {
        username: 'Новый пользователь',
        total_stickers: 0,
        registration_date: new Date()
      };
    }
    
    return {
      username: user[0].username || user[0].first_name || `Пользователь ${chatId}`,
      total_stickers: Number(user[0].stickers_created) || 0,
      registration_date: user[0].registration_date
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error.message);
    return {
      username: 'Ошибка БД',
      total_stickers: 0,
      registration_date: new Date()
    };
  }
}

// 🏆 Получить топ пользователей
async function getTopUsers(limit = 10) {
  if (!sql) {
    console.log('⚠️ База данных не подключена, возвращаем пустой топ');
    return [];
  }
  
  try {
    const users = await sql`
      SELECT 
        username,
        first_name,
        chat_id,
        stickers_created,
        registration_date
      FROM users 
      WHERE stickers_created > 0
      ORDER BY stickers_created DESC
      LIMIT ${limit}
    `;
    
    console.log(`✅ Получен топ ${users.length} пользователей`);
    
    return users.map((user, index) => ({
      rank: index + 1,
      username: user.username || user.first_name || `ID: ${user.chat_id}`,
      first_name: user.first_name,
      chat_id: user.chat_id,
      stickers_created: Number(user.stickers_created) || 0,
      registration_date: user.registration_date
    }));
  } catch (error) {
    console.error('❌ Ошибка получения топа:', error.message);
    return [];
  }
}

// 📁 Создать подборку стикеров
async function createCollection(chatId, name) {
  if (!sql) {
    console.log('⚠️ База данных не подключена, пропускаем createCollection');
    return false;
  }
  
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      console.log(`❌ Пользователь ${chatId} не найден`);
      return false;
    }
    
    // Проверяем, нет ли уже подборки с таким именем
    const existing = await sql`
      SELECT id FROM collections 
      WHERE user_id = ${user[0].id} AND name = ${name}
    `;
    
    if (existing.length > 0) {
      console.log(`❌ Подборка "${name}" уже существует`);
      return false;
    }
    
    await sql`
      INSERT INTO collections (
        user_id, name, created_at, updated_at
      ) 
      VALUES (
        ${user[0].id}, ${name}, NOW(), NOW()
      )
    `;
    
    console.log(`✅ Подборка "${name}" создана для пользователя ${chatId}`);
    return true;
  } catch (error) {
    console.error('❌ Ошибка создания подборки:', error.message);
    return false;
  }
}

// 📈 Получить общую статистику бота
async function getBotStats() {
  if (!sql) {
    return {
      total_users: 0,
      total_stickers: 0,
      active_users_last_7_days: 0,
      total_storage_mb: '0.00'
    };
  }
  
  try {
    const [totalUsers, totalStickers, activeUsers, storageUsage] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM users`,
      sql`SELECT COUNT(*) as count FROM stickers`,
      sql`SELECT COUNT(*) as count FROM users WHERE last_activity >= NOW() - INTERVAL '7 days'`,
      sql`SELECT COALESCE(SUM(sticker_size), 0) as total_size FROM stickers`
    ]);
    
    return {
      total_users: Number(totalUsers[0]?.count) || 0,
      total_stickers: Number(totalStickers[0]?.count) || 0,
      active_users_last_7_days: Number(activeUsers[0]?.count) || 0,
      total_storage_bytes: Number(storageUsage[0]?.total_size) || 0,
      total_storage_mb: (Number(storageUsage[0]?.total_size) / (1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики бота:', error.message);
    return {
      total_users: 0,
      total_stickers: 0,
      active_users_last_7_days: 0,
      total_storage_mb: '0.00'
    };
  }
}

// 📋 Получить стикеры пользователя
async function getUserStickers(chatId, limit = 50) {
  if (!sql) return [];
  
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) return [];
    
    const stickers = await sql`
      SELECT 
        id,
        effect_applied,
        sticker_size,
        file_id,
        created_at
      FROM stickers 
      WHERE user_id = ${user[0].id}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    
    return stickers.map(sticker => ({
      id: sticker.id,
      effect: sticker.effect_applied,
      size: sticker.sticker_size,
      file_id: sticker.file_id,
      created_at: sticker.created_at
    }));
  } catch (error) {
    console.error('❌ Ошибка получения стикеров пользователя:', error.message);
    return [];
  }
}

// 🗑️ Удалить стикер
async function deleteSticker(chatId, stickerId) {
  if (!sql) return false;
  
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) return false;
    
    const result = await sql`
      DELETE FROM stickers 
      WHERE id = ${stickerId} AND user_id = ${user[0].id}
      RETURNING id
    `;
    
    if (result.length > 0) {
      // Уменьшаем счетчик стикеров
      await sql`
        UPDATE users 
        SET stickers_created = GREATEST(0, stickers_created - 1)
        WHERE id = ${user[0].id}
      `;
      
      console.log(`✅ Стикер ${stickerId} удален`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Ошибка удаления стикера:', error.message);
    return false;
  }
}

// 🔧 Проверить подключение к базе
async function checkConnection() {
  if (!sql) return false;
  
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    return false;
  }
}

// Инициализируем таблицы при старте
setTimeout(() => {
  initializeTables().catch(console.error);
}, 1000);

// 📦 Экспортируем все функции
module.exports = {
  // Основные функции
  initializeTables,
  saveUser,
  saveSticker,
  
  // Статистика
  getUserStats,
  getTopUsers,
  getBotStats,
  
  // Подборки
  createCollection,
  
  // Стикеры
  getUserStickers,
  deleteSticker,
  
  // Утилиты
  checkConnection,
  
  // SQL клиент (для отладки)
  sql
};
