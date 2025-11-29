// 🗄️ БАЗА ДАННЫХ С ИСПРАВЛЕНИЯМИ
const postgres = require('postgres');

const sql = postgres(process.env.POSTGRES_URL, {
  ssl: 'require',
  idle_timeout: 20,
  max_lifetime: 60 * 30
});

let tablesInitialized = false;

// 📋 ИНИЦИАЛИЗАЦИЯ БАЗЫ
async function initializeTables() {
  if (tablesInitialized) return;
  
  try {
    console.log('🔄 Инициализация базы данных...');
    
    // Таблица пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW(),
        stickers_created INT DEFAULT 0
      )
    `;

    // Таблица стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        original_format VARCHAR(10),
        sticker_size INTEGER,
        processing_time INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Таблица подборок (УБИРАЕМ UNIQUE ОГРАНИЧЕНИЕ)
    await sql`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Таблица стикеров в подборках
    await sql`
      CREATE TABLE IF NOT EXISTS collection_stickers (
        id SERIAL PRIMARY KEY,
        collection_id INTEGER,
        sticker_id VARCHAR(100) NOT NULL,
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Таблица избранных стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS favorite_stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        sticker_id VARCHAR(100) NOT NULL,
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Таблица эффектов
    await sql`
      CREATE TABLE IF NOT EXISTS effects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Добавляем базовые эффекты
    await sql`
      INSERT INTO effects (name, description) VALUES
      ('none', 'Без эффекта'),
      ('vintage', 'Винтажный фильтр'),
      ('grayscale', 'Черно-белый'),
      ('sepia', 'Сепия'),
      ('pixelate', 'Пикселизация'),
      ('blur', 'Размытие')
      ON CONFLICT (name) DO NOTHING
    `;

    tablesInitialized = true;
    console.log('✅ База данных готова!');
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    tablesInitialized = true;
  }
}

// 📊 Сохранить пользователя
async function saveUser(chatId, username, firstName) {
  try {
    await initializeTables();
    
    await sql`
      INSERT INTO users (chat_id, username, first_name, last_active) 
      VALUES (${chatId}, ${username}, ${firstName}, NOW())
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name, 
        last_active = NOW()
    `;
    console.log(`✅ Пользователь ${chatId} сохранен`);
  } catch (error) {
    console.error('❌ Ошибка сохранения пользователя:', error);
  }
}

// 🎨 Сохранить информацию о стикере
async function saveSticker(chatId, format, stickerSize, processingTime) {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO stickers (user_id, original_format, sticker_size, processing_time)
        VALUES (${user[0].id}, ${format}, ${stickerSize}, ${processingTime})
      `;
      
      // Увеличиваем счетчик
      await sql`
        UPDATE users 
        SET stickers_created = COALESCE(stickers_created, 0) + 1 
        WHERE id = ${user[0].id}
      `;
      
      console.log('✅ Стикер сохранен');
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения стикера:', error);
  }
}

// ✨ СОЗДАТЬ ПОДБОРКУ (ИСПРАВЛЕННАЯ - БЕЗ UNIQUE)
async function createCollection(chatId, name, description = '') {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      const result = await sql`
        INSERT INTO collections (user_id, name, description)
        VALUES (${user[0].id}, ${name}, ${description})
        RETURNING id
      `;
      console.log(`✅ Подборка "${name}" создана`);
      return result[0];
    }
  } catch (error) {
    console.error('❌ Ошибка создания подборки:', error);
    throw error;
  }
}

// 🗑️ УДАЛИТЬ ПОДБОРКУ
async function deleteCollection(chatId, collectionId) {
  try {
    await initializeTables();
    
    await sql`
      DELETE FROM collections 
      WHERE id = ${collectionId} AND user_id = (SELECT id FROM users WHERE chat_id = ${chatId})
    `;
    console.log(`✅ Подборка ${collectionId} удалена`);
  } catch (error) {
    console.error('❌ Ошибка удаления подборки:', error);
    throw error;
  }
}

// ➕ ДОБАВИТЬ СТИКЕР В ПОДБОРКУ (ИСПРАВЛЕННАЯ)
async function addStickerToCollection(collectionId, stickerId) {
  try {
    await initializeTables();
    
    await sql`
      INSERT INTO collection_stickers (collection_id, sticker_id)
      VALUES (${collectionId}, ${stickerId})
    `;
    console.log(`✅ Стикер ${stickerId} добавлен в подборку ${collectionId}`);
  } catch (error) {
    console.error('❌ Ошибка добавления стикера в подборку:', error);
    throw error;
  }
}

// ⭐ ДОБАВИТЬ В ИЗБРАННОЕ (ИСПРАВЛЕННАЯ)
async function addToFavorites(chatId, stickerId) {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO favorite_stickers (user_id, sticker_id)
        VALUES (${user[0].id}, ${stickerId})
      `;
      console.log(`✅ Стикер ${stickerId} добавлен в избранное`);
    }
  } catch (error) {
    console.error('❌ Ошибка добавления в избранное:', error);
    throw error;
  }
}

// 🎭 ПОЛУЧИТЬ ЭФФЕКТЫ
async function getAvailableEffects(chatId) {
  try {
    await initializeTables();
    
    const effects = await sql`SELECT * FROM effects ORDER BY name`;
    return effects;
  } catch (error) {
    console.error('❌ Ошибка получения эффектов:', error);
    return [
      { name: 'none', description: 'Без эффекта' },
      { name: 'vintage', description: 'Винтажный фильтр' },
      { name: 'grayscale', description: 'Черно-белый' },
      { name: 'sepia', description: 'Сепия' },
      { name: 'pixelate', description: 'Пикселизация' },
      { name: 'blur', description: 'Размытие' }
    ];
  }
}

// 📚 ПОЛУЧИТЬ ПОДБОРКИ ПОЛЬЗОВАТЕЛЯ
async function getUserCollections(chatId) {
  try {
    await initializeTables();
    
    const collections = await sql`
      SELECT c.*, COUNT(cs.id) as stickers_count
      FROM collections c
      LEFT JOIN collection_stickers cs ON c.id = cs.collection_id
      WHERE c.user_id = (SELECT id FROM users WHERE chat_id = ${chatId})
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;
    
    return collections;
  } catch (error) {
    console.error('❌ Ошибка получения подборок:', error);
    return [];
  }
}

// ⭐ ПОЛУЧИТЬ ИЗБРАННЫЕ СТИКЕРЫ
async function getUserFavorites(chatId) {
  try {
    await initializeTables();
    
    const favorites = await sql`
      SELECT fs.* 
      FROM favorite_stickers fs
      JOIN users u ON fs.user_id = u.id
      WHERE u.chat_id = ${chatId}
      ORDER BY fs.added_at DESC
    `;
    
    return favorites;
  } catch (error) {
    console.error('❌ Ошибка получения избранного:', error);
    return [];
  }
}

// 📊 Получить статистику пользователя
async function getUserStats(chatId) {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT COALESCE(stickers_created, 0) as stickers_created 
      FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return { total_stickers: 0, today_stickers: 0, collections_count: 0, favorites_count: 0 };
    }
    
    const stats = await sql`
      SELECT 
        ${user[0].stickers_created} as total_stickers,
        COUNT(s.id) as today_stickers,
        COUNT(DISTINCT c.id) as collections_count,
        COUNT(DISTINCT fs.id) as favorites_count
      FROM users u
      LEFT JOIN stickers s ON u.id = s.user_id AND DATE(s.created_at) = CURRENT_DATE
      LEFT JOIN collections c ON u.id = c.user_id
      LEFT JOIN favorite_stickers fs ON u.id = fs.user_id
      WHERE u.chat_id = ${chatId}
      GROUP BY u.id
    `;
    
    return stats[0] || { 
      total_stickers: user[0].stickers_created, 
      today_stickers: 0, 
      collections_count: 0, 
      favorites_count: 0 
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    return { total_stickers: 0, today_stickers: 0, collections_count: 0, favorites_count: 0 };
  }
}

// 🏆 Топ пользователей
async function getTopUsers(limit = 5) {
  try {
    await initializeTables();
    
    const topUsers = await sql`
      SELECT username, first_name, stickers_created
      FROM users 
      WHERE stickers_created > 0
      ORDER BY stickers_created DESC 
      LIMIT ${limit}
    `;
    
    return topUsers;
  } catch (error) {
    console.error('❌ Ошибка получения топа:', error);
    return [];
  }
}

// 🔢 Получить количество пользователей
async function getUserCount() {
  try {
    await initializeTables();
    
    const result = await sql`SELECT COUNT(*) as count FROM users`;
    return result[0].count;
  } catch (error) {
    console.error('❌ Ошибка получения количества пользователей:', error);
    return 0;
  }
}

module.exports = {
  saveUser,
  saveSticker,
  getUserStats,
  getTopUsers,
  getUserCount,
  createCollection,
  deleteCollection,
  addStickerToCollection,
  addToFavorites,
  getUserCollections,
  getUserFavorites,
  getAvailableEffects
};
