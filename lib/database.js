const postgres = require('postgres');

// Подключение к Neon
const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ NEON_DATABASE_URL не найден в переменных окружения');
  throw new Error('Database connection string is missing');
}

const sql = postgres(connectionString, { 
  ssl: 'require',
  max: 5
});

// Инициализация таблиц
async function initDatabase() {
  try {
    console.log('🔄 Инициализация базы данных...');
    
    // Таблица пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        stickers_count INTEGER DEFAULT 0,
        rating INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Таблица папок
    await sql`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Таблица стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        folder_id INTEGER REFERENCES folders(id),
        image_data BYTEA NOT NULL,
        effect_type VARCHAR(50),
        text_overlay TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
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
    let user = await sql`
      SELECT * FROM users WHERE telegram_id = ${telegramId}
    `;
    
    if (user.length === 0) {
      user = await sql`
        INSERT INTO users (telegram_id, username)
        VALUES (${telegramId}, ${username})
        RETURNING *
      `;
      console.log(`👤 Новый пользователь: ${username} (${telegramId})`);
    } else if (username && user[0].username !== username) {
      await sql`
        UPDATE users SET username = ${username}
        WHERE telegram_id = ${telegramId}
      `;
    }
    
    return user[0];
  } catch (error) {
    console.error('❌ Ошибка getUser:', error);
    throw error;
  }
}

// Сохранить стикер
async function saveSticker(telegramId, imageBuffer, effectType, textOverlay) {
  try {
    const result = await sql`
      INSERT INTO stickers (user_id, image_data, effect_type, text_overlay)
      VALUES (
        (SELECT id FROM users WHERE telegram_id = ${telegramId}),
        ${imageBuffer},
        ${effectType},
        ${textOverlay}
      )
      RETURNING id
    `;
    
    console.log(`✅ Стикер сохранен: ID ${result[0].id}, эффект: ${effectType}`);
    return result[0].id;
    
  } catch (error) {
    console.error('❌ Ошибка saveSticker:', error);
    throw error;
  }
}

// Получить стикеры пользователя
async function getUserStickers(telegramId) {
  try {
    const stickers = await sql`
      SELECT s.* FROM stickers s
      JOIN users u ON s.user_id = u.id
      WHERE u.telegram_id = ${telegramId}
      ORDER BY s.created_at DESC
      LIMIT 50
    `;
    
    console.log(`📚 Загружено ${stickers.length} стикеров для ${telegramId}`);
    return stickers;
    
  } catch (error) {
    console.error('❌ Ошибка getUserStickers:', error);
    return [];
  }
}

// Создать папку
async function createFolder(telegramId, name) {
  try {
    const result = await sql`
      INSERT INTO folders (user_id, name)
      VALUES (
        (SELECT id FROM users WHERE telegram_id = ${telegramId}),
        ${name}
      )
      RETURNING *
    `;
    
    console.log(`📂 Папка создана: "${name}" для ${telegramId}`);
    return result[0];
    
  } catch (error) {
    console.error('❌ Ошибка createFolder:', error);
    throw error;
  }
}

// Получить папки пользователя
async function getFolders(telegramId) {
  try {
    const folders = await sql`
      SELECT f.* FROM folders f
      JOIN users u ON f.user_id = u.id
      WHERE u.telegram_id = ${telegramId}
      ORDER BY f.created_at DESC
    `;
    
    return folders;
    
  } catch (error) {
    console.error('❌ Ошибка getFolders:', error);
    return [];
  }
}

// Удалить папку
async function deleteFolder(folderId, telegramId) {
  try {
    // Проверяем владельца
    const folder = await sql`
      SELECT f.* FROM folders f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ${folderId} AND u.telegram_id = ${telegramId}
    `;
    
    if (folder.length === 0) {
      throw new Error('Папка не найдена или нет прав');
    }
    
    await sql`DELETE FROM folders WHERE id = ${folderId}`;
    console.log(`🗑️ Папка удалена: ${folderId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка deleteFolder:', error);
    throw error;
  }
}

// Удалить стикер
async function deleteSticker(stickerId, telegramId) {
  try {
    // Проверяем владельца
    const sticker = await sql`
      SELECT s.* FROM stickers s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ${stickerId} AND u.telegram_id = ${telegramId}
    `;
    
    if (sticker.length === 0) {
      throw new Error('Стикер не найден или нет прав');
    }
    
    await sql`DELETE FROM stickers WHERE id = ${stickerId}`;
    console.log(`🗑️ Стикер удален: ${stickerId}`);
    return true;
    
  } catch (error) {
    console.error('❌ Ошибка deleteSticker:', error);
    throw error;
  }
}

// Обновить статистику
async function updateStats(telegramId) {
  try {
    // Считаем стикеры
    const count = await sql`
      SELECT COUNT(*) as count FROM stickers s
      JOIN users u ON s.user_id = u.id
      WHERE u.telegram_id = ${telegramId}
    `;
    
    // Обновляем счетчик
    await sql`
      UPDATE users 
      SET stickers_count = ${count[0].count},
          rating = LEAST(10, 5 + (${count[0].count} / 10))
      WHERE telegram_id = ${telegramId}
    `;
    
    console.log(`📊 Статистика обновлена для ${telegramId}: ${count[0].count} стикеров`);
    
  } catch (error) {
    console.error('❌ Ошибка updateStats:', error);
  }
}

// Получить статистику
async function getStats(telegramId) {
  try {
    const stats = await sql`
      SELECT 
        u.username,
        u.stickers_count,
        u.rating,
        u.created_at,
        COALESCE(COUNT(DISTINCT f.id), 0) as folders_count
      FROM users u
      LEFT JOIN folders f ON u.id = f.user_id
      WHERE u.telegram_id = ${telegramId}
      GROUP BY u.id
    `;
    
    return stats[0] || {
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

module.exports = {
  initDatabase,
  getUser,
  saveSticker,
  getUserStickers,
  createFolder,
  getFolders,
  deleteFolder,
  deleteSticker,
  updateStats,
  getStats,
  sql
};
