// database.js - База данных для Telegram стикер-бота (Vercel + Neon)
const { neon } = require('@neondatabase/serverless');

// Подключение к Neon PostgreSQL
const sql = neon(process.env.DATABASE_URL);

// 🗄️ Инициализация таблиц
async function initializeTables() {
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
        original_format VARCHAR(50),
        sticker_size INT,
        processing_time FLOAT DEFAULT 0,
        effect_applied VARCHAR(100) DEFAULT 'none',
        file_id VARCHAR(500),
        original_url TEXT,
        processed_url TEXT,
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

    // Таблица настроек эффектов
    await sql`
      CREATE TABLE IF NOT EXISTS effect_settings (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        effect_name VARCHAR(100),
        intensity FLOAT DEFAULT 1.0,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('✅ Таблицы инициализированы');
  } catch (error) {
    console.error('❌ Ошибка инициализации таблиц:', error);
    throw error;
  }
}

// 👤 Регистрация/обновление пользователя
async function saveUser(userData) {
  try {
    const { id, username, first_name, last_name, language_code, is_bot } = userData;

    const result = await sql`
      INSERT INTO users (
        chat_id, username, first_name, last_name, 
        language_code, is_bot, last_activity
      ) 
      VALUES (
        ${id}, ${username}, ${first_name}, ${last_name}, 
        ${language_code}, ${is_bot || false}, NOW()
      )
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        language_code = EXCLUDED.language_code,
        last_activity = NOW()
      RETURNING id
    `;

    console.log(`✅ Пользователь сохранен: ${username || id}`);
    return result[0];
  } catch (error) {
    console.error('❌ Ошибка сохранения пользователя:', error);
    throw error;
  }
}

// 🎨 Сохранить информацию о стикере
async function saveSticker(chatId, fileId, effect = 'none', sizeBytes = 0, originalUrl = '', processedUrl = '') {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO stickers (
          user_id, original_format, sticker_size, 
          processing_time, effect_applied, file_id,
          original_url, processed_url
        )
        VALUES (
          ${user[0].id}, 'photo', ${sizeBytes}, 
          0, ${effect}, ${fileId},
          ${originalUrl}, ${processedUrl}
        )
      `;
      
      // Увеличиваем счетчик стикеров у пользователя
      await sql`
        UPDATE users 
        SET stickers_created = stickers_created + 1 
        WHERE id = ${user[0].id}
      `;
      
      console.log(`✅ Стикер сохранен с эффектом: ${effect}, file_id: ${fileId}`);
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения стикера:', error);
    throw error;
  }
}

// 📊 Получить статистику пользователя
async function getUserStats(chatId) {
  try {
    const user = await sql`
      SELECT 
        username,
        registration_date,
        stickers_created,
        premium,
        last_activity
      FROM users 
      WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return null;
    }
    
    // Получаем общую статистику по стикерам пользователя
    const stickers = await sql`
      SELECT 
        COUNT(*) as total_stickers,
        COALESCE(SUM(sticker_size), 0) as total_size,
        COALESCE(AVG(processing_time), 0) as avg_processing_time
      FROM stickers 
      WHERE user_id = (SELECT id FROM users WHERE chat_id = ${chatId})
    `;
    
    // Получаем популярные эффекты
    const popularEffects = await sql`
      SELECT 
        effect_applied,
        COUNT(*) as count
      FROM stickers 
      WHERE user_id = (SELECT id FROM users WHERE chat_id = ${chatId})
        AND effect_applied != 'none'
      GROUP BY effect_applied
      ORDER BY count DESC
      LIMIT 5
    `;
    
    // Получаем последние стикеры
    const recentStickers = await sql`
      SELECT 
        effect_applied,
        created_at,
        sticker_size
      FROM stickers 
      WHERE user_id = (SELECT id FROM users WHERE chat_id = ${chatId})
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    // Формируем статистику
    const stats = {
      username: user[0].username || user[0].first_name || `Пользователь ${chatId}`,
      registration_date: user[0].registration_date,
      stickers_created: Number(user[0].stickers_created) || 0,
      premium: user[0].premium,
      last_activity: user[0].last_activity,
      
      total_stickers: Number(stickers[0]?.total_stickers) || 0,
      total_size_bytes: Number(stickers[0]?.total_size) || 0,
      total_size_mb: (Number(stickers[0]?.total_size) / (1024 * 1024)).toFixed(2),
      avg_processing_time: (Number(stickers[0]?.avg_processing_time) || 0).toFixed(2),
      
      popular_effects: popularEffects.map(effect => ({
        name: effect.effect_applied,
        count: Number(effect.count)
      })),
      
      recent_stickers: recentStickers.map(sticker => ({
        effect: sticker.effect_applied,
        date: sticker.created_at,
        size: (sticker.sticker_size / 1024).toFixed(1) + ' KB'
      }))
    };
    
    console.log(`📊 Статистика получена для ${chatId}`);
    return stats;
    
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    throw error;
  }
}

// 🏆 Получить топ пользователей
async function getTopUsers(limit = 10, period = 'all') {
  try {
    let dateFilter = '';
    
    // Фильтр по периоду
    switch(period) {
      case 'day':
        dateFilter = `AND last_activity >= NOW() - INTERVAL '1 day'`;
        break;
      case 'week':
        dateFilter = `AND last_activity >= NOW() - INTERVAL '7 days'`;
        break;
      case 'month':
        dateFilter = `AND last_activity >= NOW() - INTERVAL '30 days'`;
        break;
      default:
        dateFilter = '';
    }
    
    // Получаем топ пользователей
    const topUsers = await sql`
      SELECT 
        username,
        first_name,
        chat_id,
        stickers_created,
        premium,
        registration_date,
        ROW_NUMBER() OVER (ORDER BY stickers_created DESC) as rank
      FROM users 
      WHERE stickers_created > 0 ${sql.unsafe(dateFilter)}
      ORDER BY stickers_created DESC
      LIMIT ${limit}
    `;
    
    // Получаем общую статистику
    const totalStats = await sql`
      SELECT 
        COUNT(*) as total_users,
        SUM(stickers_created) as total_stickers_created,
        AVG(stickers_created) as avg_stickers_per_user
      FROM users
      WHERE stickers_created > 0 ${sql.unsafe(dateFilter)}
    `;
    
    console.log(`🏆 Топ ${limit} пользователей получен (период: ${period})`);
    
    return {
      period: period,
      total_users: Number(totalStats[0]?.total_users) || 0,
      total_stickers_created: Number(totalStats[0]?.total_stickers_created) || 0,
      avg_stickers_per_user: (Number(totalStats[0]?.avg_stickers_per_user) || 0).toFixed(1),
      users: topUsers.map(user => ({
        rank: Number(user.rank),
        username: user.username || user.first_name || `ID: ${user.chat_id}`,
        chat_id: user.chat_id,
        stickers_created: Number(user.stickers_created),
        premium: user.premium,
        registration_date: user.registration_date
      }))
    };
    
  } catch (error) {
    console.error('❌ Ошибка получения топа:', error);
    throw error;
  }
}

// 📁 Создать подборку стикеров
async function createCollection(chatId, collectionName, stickerIds = [], description = '', isPublic = false) {
  try {
    // Проверяем существование пользователя
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      console.log(`❌ Пользователь ${chatId} не найден`);
      return { success: false, error: 'Пользователь не найден' };
    }
    
    // Проверяем, нет ли подборки с таким именем у пользователя
    const existingCollection = await sql`
      SELECT id FROM collections 
      WHERE user_id = ${user[0].id} AND name = ${collectionName}
    `;
    
    if (existingCollection.length > 0) {
      return { 
        success: false, 
        error: 'Подборка с таким именем уже существует' 
      };
    }
    
    // Создаем подборку
    const result = await sql`
      INSERT INTO collections (
        user_id, 
        name, 
        description, 
        sticker_count,
        is_public,
        created_at,
        updated_at
      ) 
      VALUES (
        ${user[0].id},
        ${collectionName},
        ${description},
        ${stickerIds.length},
        ${isPublic},
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    
    const collectionId = result[0].id;
    
    // Если есть стикеры, добавляем их в подборку
    if (stickerIds.length > 0) {
      const validStickerIds = [];
      
      for (const stickerId of stickerIds) {
        // Проверяем, что стикер принадлежит пользователю
        const sticker = await sql`
          SELECT id FROM stickers 
          WHERE id = ${stickerId} 
            AND user_id = ${user[0].id}
        `;
        
        if (sticker.length > 0) {
          validStickerIds.push(stickerId);
          
          await sql`
            INSERT INTO collection_stickers (
              collection_id,
              sticker_id,
              added_at
            )
            VALUES (
              ${collectionId},
              ${stickerId},
              NOW()
            )
            ON CONFLICT (collection_id, sticker_id) DO NOTHING
          `;
        }
      }
      
      // Обновляем счетчик стикеров в подборке
      await sql`
        UPDATE collections 
        SET 
          sticker_count = ${validStickerIds.length},
          updated_at = NOW()
        WHERE id = ${collectionId}
      `;
    }
    
    console.log(`✅ Подборка создана: "${collectionName}" (ID: ${collectionId})`);
    
    return {
      success: true,
      collectionId: collectionId,
      name: collectionName,
      description: description,
      stickerCount: stickerIds.length,
      isPublic: isPublic,
      createdAt: new Date()
    };
    
  } catch (error) {
    console.error('❌ Ошибка создания подборки:', error);
    throw error;
  }
}

// 📂 Получить подборки пользователя
async function getUserCollections(chatId) {
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return [];
    }
    
    const collections = await sql`
      SELECT 
        id,
        name,
        description,
        sticker_count,
        is_public,
        created_at,
        updated_at
      FROM collections 
      WHERE user_id = ${user[0].id}
      ORDER BY updated_at DESC
    `;
    
    return collections.map(collection => ({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      sticker_count: Number(collection.sticker_count),
      is_public: collection.is_public,
      created_at: collection.created_at,
      updated_at: collection.updated_at
    }));
    
  } catch (error) {
    console.error('❌ Ошибка получения подборок:', error);
    throw error;
  }
}

// 🗑️ Удалить подборку
async function deleteCollection(chatId, collectionId) {
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return { success: false, error: 'Пользователь не найден' };
    }
    
    // Проверяем, что подборка принадлежит пользователю
    const collection = await sql`
      SELECT id FROM collections 
      WHERE id = ${collectionId} AND user_id = ${user[0].id}
    `;
    
    if (collection.length === 0) {
      return { success: false, error: 'Подборка не найдена или доступ запрещен' };
    }
    
    // Удаляем подборку (каскадное удаление связей через foreign key)
    await sql`
      DELETE FROM collections WHERE id = ${collectionId}
    `;
    
    console.log(`🗑️ Подборка ${collectionId} удалена`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Ошибка удаления подборки:', error);
    throw error;
  }
}

// 🔍 Получить стикеры пользователя
async function getUserStickers(chatId, limit = 50, offset = 0) {
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return [];
    }
    
    const stickers = await sql`
      SELECT 
        id,
        effect_applied,
        sticker_size,
        file_id,
        original_url,
        processed_url,
        created_at
      FROM stickers 
      WHERE user_id = ${user[0].id}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    const totalCount = await sql`
      SELECT COUNT(*) as count FROM stickers 
      WHERE user_id = ${user[0].id}
    `;
    
    return {
      stickers: stickers.map(sticker => ({
        id: sticker.id,
        effect: sticker.effect_applied,
        size: sticker.sticker_size,
        file_id: sticker.file_id,
        original_url: sticker.original_url,
        processed_url: sticker.processed_url,
        created_at: sticker.created_at,
        size_kb: (sticker.sticker_size / 1024).toFixed(1)
      })),
      total: Number(totalCount[0]?.count) || 0,
      limit: limit,
      offset: offset
    };
    
  } catch (error) {
    console.error('❌ Ошибка получения стикеров:', error);
    throw error;
  }
}

// 🔧 Обновить настройки эффекта
async function updateEffectSettings(chatId, effectName, intensity = 1.0, isDefault = false) {
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return { success: false, error: 'Пользователь не найден' };
    }
    
    // Сбрасываем предыдущие настройки по умолчанию, если нужно
    if (isDefault) {
      await sql`
        UPDATE effect_settings 
        SET is_default = false 
        WHERE user_id = ${user[0].id}
      `;
    }
    
    // Обновляем или создаем настройки
    const result = await sql`
      INSERT INTO effect_settings (
        user_id, effect_name, intensity, is_default
      )
      VALUES (
        ${user[0].id}, ${effectName}, ${intensity}, ${isDefault}
      )
      ON CONFLICT (user_id, effect_name) 
      DO UPDATE SET 
        intensity = EXCLUDED.intensity,
        is_default = EXCLUDED.is_default,
        created_at = NOW()
      RETURNING id
    `;
    
    return {
      success: true,
      settingsId: result[0].id,
      effectName: effectName,
      intensity: intensity,
      isDefault: isDefault
    };
    
  } catch (error) {
    console.error('❌ Ошибка обновления настроек:', error);
    throw error;
  }
}

// 📈 Получить общую статистику бота
async function getBotStats() {
  try {
    const [totalUsers, totalStickers, activeUsers, storageUsage] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM users`,
      sql`SELECT COUNT(*) as count FROM stickers`,
      sql`SELECT COUNT(*) as count FROM users WHERE last_activity >= NOW() - INTERVAL '7 days'`,
      sql`SELECT COALESCE(SUM(sticker_size), 0) as total_size FROM stickers`
    ]);
    
    // Получаем популярные эффекты
    const popularEffects = await sql`
      SELECT 
        effect_applied,
        COUNT(*) as count
      FROM stickers 
      WHERE effect_applied != 'none'
      GROUP BY effect_applied
      ORDER BY count DESC
      LIMIT 10
    `;
    
    // Получаем активность по дням
    const dailyActivity = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as sticker_count
      FROM stickers 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    
    return {
      total_users: Number(totalUsers[0]?.count) || 0,
      total_stickers: Number(totalStickers[0]?.count) || 0,
      active_users_last_7_days: Number(activeUsers[0]?.count) || 0,
      total_storage_bytes: Number(storageUsage[0]?.total_size) || 0,
      total_storage_mb: (Number(storageUsage[0]?.total_size) / (1024 * 1024)).toFixed(2),
      
      popular_effects: popularEffects.map(effect => ({
        name: effect.effect_applied,
        count: Number(effect.count)
      })),
      
      daily_activity: dailyActivity.map(day => ({
        date: day.date,
        sticker_count: Number(day.sticker_count)
      }))
    };
    
  } catch (error) {
    console.error('❌ Ошибка получения статистики бота:', error);
    throw error;
  }
}

// Экспортируем все функции
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
  getUserCollections,
  deleteCollection,
  
  // Стикеры
  getUserStickers,
  
  // Настройки
  updateEffectSettings,
  
  // SQL соединение (если нужно напрямую)
  sql
};
