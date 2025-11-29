// 🗄️ БАЗА ДАННЫХ С АВТОМАТИЧЕСКИМ ИСПРАВЛЕНИЕМ
const postgres = require('postgres');

const sql = postgres(process.env.POSTGRES_URL, {
  ssl: 'require',
  idle_timeout: 20,
  max_lifetime: 60 * 30
});

let tablesInitialized = false;

// 🆕 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ БАЗЫ
async function autoFixDatabase() {
  try {
    console.log('🔄 Автоматическое исправление структуры базы...');
    
    // Добавляем недостающие столбцы
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS premium_level INT DEFAULT 0
    `;
    console.log('✅ Столбец premium_level добавлен');
    
    await sql`
      ALTER TABLE stickers 
      ADD COLUMN IF NOT EXISTS effect_applied VARCHAR(50) DEFAULT 'none'
    `;
    console.log('✅ Столбец effect_applied добавлен');
    
    // Создаем таблицу эффектов если её нет
    await sql`
      CREATE TABLE IF NOT EXISTS effects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        is_premium BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Добавляем базовые эффекты
    await sql`
      INSERT INTO effects (name, description, is_premium) VALUES
      ('none', 'Без эффекта', false),
      ('vintage', 'Винтажный фильтр', false),
      ('grayscale', 'Черно-белый', false),
      ('sepia', 'Сепия', false),
      ('pixelate', 'Пикселизация', false),
      ('blur', 'Размытие', true)
      ON CONFLICT (name) DO NOTHING
    `;
    
    console.log('✅ База данных автоматически исправлена');
  } catch (error) {
    console.error('❌ Не удалось автоматически исправить базу:', error);
  }
}

// 📋 Функция для создания таблиц
async function initializeTables() {
  if (tablesInitialized) return;
  
  try {
    console.log('🗄️ Инициализирую базу данных...');
    
    // Таблица пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW(),
        stickers_created INT DEFAULT 0,
        premium_level INT DEFAULT 0
      );
    `;

    // Таблица стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        original_format VARCHAR(10),
        sticker_size INTEGER,
        processing_time INTEGER,
        effect_applied VARCHAR(50) DEFAULT 'none',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Таблица подборок
    await sql`
      CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        cover_sticker_data TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `;

    // Таблица стикеров в подборках
    await sql`
      CREATE TABLE IF NOT EXISTS collection_stickers (
        id SERIAL PRIMARY KEY,
        collection_id INTEGER REFERENCES collections(id),
        sticker_data TEXT,
        sticker_order INTEGER DEFAULT 0,
        added_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Таблица избранных стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS favorite_stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        sticker_data TEXT,
        effect_type VARCHAR(50),
        added_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Таблица эффектов
    await sql`
      CREATE TABLE IF NOT EXISTS effects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        is_premium BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // Базовые эффекты
    await sql`
      INSERT INTO effects (name, description, is_premium) VALUES
      ('none', 'Без эффекта', false),
      ('vintage', 'Винтажный фильтр', false),
      ('grayscale', 'Черно-белый', false),
      ('sepia', 'Сепия', false),
      ('pixelate', 'Пикселизация', false),
      ('blur', 'Размытие', true)
      ON CONFLICT (name) DO NOTHING;
    `;

    tablesInitialized = true;
    console.log('🎉 База данных инициализирована!');
    
  } catch (error) {
    console.error('❌ Ошибка инициализации таблиц:', error);
    // Автоматически исправляем базу при ошибке
    await autoFixDatabase();
    tablesInitialized = true;
  }
}

// 📊 Сохранить пользователя
async function saveUser(chatId, username, firstName) {
  try {
    await initializeTables();
    
    const result = await sql`
      INSERT INTO users (chat_id, username, first_name, last_active) 
      VALUES (${chatId}, ${username}, ${firstName}, NOW())
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name, 
        last_active = NOW()
      RETURNING id
    `;
    console.log(`✅ Пользователь ${chatId} сохранен`);
    return result[0];
  } catch (error) {
    console.error('❌ Ошибка сохранения пользователя:', error);
    throw error;
  }
}

// 🎨 Сохранить информацию о стикере
async function saveSticker(chatId, format, stickerSize, processingTime, effect = 'none') {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO stickers (user_id, original_format, sticker_size, processing_time, effect_applied)
        VALUES (${user[0].id}, ${format}, ${stickerSize}, ${processingTime}, ${effect})
      `;
      
      // Увеличиваем счетчик стикеров
      await sql`
        UPDATE users 
        SET stickers_created = stickers_created + 1 
        WHERE id = ${user[0].id}
      `;
      
      console.log(`✅ Стикер сохранен с эффектом: ${effect}`);
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения стикера:', error);
  }
}

// 🎭 ПОЛУЧИТЬ ДОСТУПНЫЕ ЭФФЕКТЫ (ИСПРАВЛЕННАЯ)
async function getAvailableEffects(chatId) {
  try {
    await initializeTables();
    
    // Сначала проверяем существование столбца premium_level
    try {
      const effects = await sql`
        SELECT * FROM effects 
        ORDER BY is_premium, name
      `;
      return effects;
    } catch (error) {
      // Если столбца нет, возвращаем эффекты без фильтрации
      console.log('🔄 Столбец premium_level не найден, возвращаю все эффекты...');
      const effects = await sql`SELECT * FROM effects ORDER BY name`;
      return effects;
    }
    
  } catch (error) {
    console.error('❌ Ошибка получения эффектов:', error);
    // Возвращаем базовые эффекты при ошибке
    return [
      { name: 'none', description: 'Без эффекта', is_premium: false },
      { name: 'vintage', description: 'Винтажный фильтр', is_premium: false },
      { name: 'grayscale', description: 'Черно-белый', is_premium: false },
      { name: 'sepia', description: 'Сепия', is_premium: false },
      { name: 'pixelate', description: 'Пикселизация', is_premium: false }
    ];
  }
}

// 📊 Получить статистику пользователя (ИСПРАВЛЕННАЯ)
async function getUserStats(chatId) {
  try {
    await initializeTables();
    
    const stats = await sql`
      SELECT 
        COALESCE(u.stickers_created, 0) as total_stickers,
        COUNT(s.id) as today_stickers,
        COUNT(DISTINCT c.id) as collections_count,
        COUNT(DISTINCT fs.id) as favorites_count
      FROM users u
      LEFT JOIN stickers s ON u.id = s.user_id AND DATE(s.created_at) = CURRENT_DATE
      LEFT JOIN collections c ON u.id = c.user_id
      LEFT JOIN favorite_stickers fs ON u.id = fs.user_id
      WHERE u.chat_id = ${chatId}
      GROUP BY u.id, u.stickers_created
    `;
    
    return stats[0] || { 
      total_stickers: 0, 
      today_stickers: 0, 
      collections_count: 0, 
      favorites_count: 0 
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    return { total_stickers: 0, today_stickers: 0, collections_count: 0, favorites_count: 0 };
  }
}

// ✨ СОЗДАТЬ ПОДБОРКУ
async function createCollection(chatId, name, description = '', isPublic = false) {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      const result = await sql`
        INSERT INTO collections (user_id, name, description, is_public)
        VALUES (${user[0].id}, ${name}, ${description}, ${isPublic})
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

// ➕ ДОБАВИТЬ СТИКЕР В ПОДБОРКУ
async function addStickerToCollection(collectionId, stickerData) {
  try {
    await initializeTables();
    
    const maxOrder = await sql`
      SELECT COALESCE(MAX(sticker_order), 0) as max_order 
      FROM collection_stickers 
      WHERE collection_id = ${collectionId}
    `;
    
    await sql`
      INSERT INTO collection_stickers (collection_id, sticker_data, sticker_order)
      VALUES (${collectionId}, ${stickerData}, ${maxOrder[0].max_order + 1})
    `;
    console.log('✅ Стикер добавлен в подборку');
  } catch (error) {
    console.error('❌ Ошибка добавления стикера в подборку:', error);
    throw error;
  }
}

// ⭐ ДОБАВИТЬ В ИЗБРАННОЕ
async function addToFavorites(chatId, stickerData, effectType = 'none') {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO favorite_stickers (user_id, sticker_data, effect_type)
        VALUES (${user[0].id}, ${stickerData}, ${effectType})
      `;
      console.log('✅ Стикер добавлен в избранное');
    }
  } catch (error) {
    console.error('❌ Ошибка добавления в избранное:', error);
    throw error;
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

// 🏆 Топ пользователей
async function getTopUsers(limit = 5) {
  try {
    await initializeTables();
    
    const topUsers = await sql`
      SELECT 
        username, first_name, stickers_created
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
  addStickerToCollection,
  addToFavorites,
  getUserCollections,
  getUserFavorites,
  getAvailableEffects,
  initializeTables // Экспортируем для ручного вызова
};
