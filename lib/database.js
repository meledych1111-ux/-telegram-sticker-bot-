// lib/database.js - ПРОСТОЙ РАБОЧИЙ ФАЙЛ
console.log('📦 Загрузка database.js...');

const { neon } = require('@neondatabase/serverless');

let sql = null;

// Проверяем наличие DATABASE_URL
if (process.env.DATABASE_URL) {
  try {
    sql = neon(process.env.DATABASE_URL);
    console.log('✅ Neon PostgreSQL подключен');
  } catch (error) {
    console.error('❌ Ошибка подключения к Neon:', error.message);
  }
} else {
  console.log('⚠️ DATABASE_URL не установлен');
}

// Инициализация таблиц
async function initializeTables() {
  if (!sql) {
    console.log('⚠️ База данных не подключена, пропускаем инициализацию');
    return;
  }
  
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        registration_date TIMESTAMP DEFAULT NOW(),
        stickers_created INT DEFAULT 0
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        effect_applied VARCHAR(100) DEFAULT 'none',
        file_id VARCHAR(500),
        sticker_size INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    console.log('✅ Таблицы созданы (или уже существуют)');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error.message);
  }
}

// Сохранить пользователя
async function saveUser(chatId, username, firstName) {
  if (!sql) {
    console.log(`⚠️ База не подключена, пропускаем saveUser для ${chatId}`);
    return null;
  }
  
  try {
    const result = await sql`
      INSERT INTO users (chat_id, username, first_name, registration_date)
      VALUES (${chatId}, ${username || ''}, ${firstName || ''}, NOW())
      ON CONFLICT (chat_id) DO UPDATE
      SET username = EXCLUDED.username,
          first_name = EXCLUDED.first_name
      RETURNING id
    `;
    
    console.log(`✅ Пользователь ${chatId} сохранен/обновлен`);
    return result[0]?.id;
  } catch (error) {
    console.error('❌ Ошибка saveUser:', error.message);
    return null;
  }
}

// Получить статистику пользователя
async function getUserStats(chatId) {
  console.log(`📊 Вызов getUserStats для ${chatId}`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, возвращаю тестовые данные');
    return {
      username: 'Пользователь',
      total_stickers: 0,
      registration_date: new Date()
    };
  }
  
  try {
    const result = await sql`
      SELECT username, stickers_created, registration_date 
      FROM users 
      WHERE chat_id = ${chatId}
    `;
    
    if (result.length > 0) {
      return {
        username: result[0].username || 'Пользователь',
        total_stickers: result[0].stickers_created || 0,
        registration_date: result[0].registration_date
      };
    }
    
    return {
      username: 'Новый пользователь',
      total_stickers: 0,
      registration_date: new Date()
    };
  } catch (error) {
    console.error('❌ Ошибка getUserStats:', error.message);
    return {
      username: 'Ошибка БД',
      total_stickers: 0,
      registration_date: new Date()
    };
  }
}

// Получить топ пользователей
async function getTopUsers(limit = 10) {
  console.log(`🏆 Вызов getTopUsers, лимит: ${limit}`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, возвращаю пустой топ');
    return [];
  }
  
  try {
    const result = await sql`
      SELECT username, stickers_created, chat_id
      FROM users 
      WHERE stickers_created > 0
      ORDER BY stickers_created DESC
      LIMIT ${limit}
    `;
    
    return result.map((user, index) => ({
      rank: index + 1,
      username: user.username || `ID: ${user.chat_id}`,
      chat_id: user.chat_id,
      stickers_created: user.stickers_created || 0
    }));
  } catch (error) {
    console.error('❌ Ошибка getTopUsers:', error.message);
    return [];
  }
}

// Сохранить стикер
async function saveSticker(chatId, fileId, effect = 'none', sizeBytes = 0) {
  console.log(`🎨 Вызов saveSticker: ${chatId}, эффект: ${effect}`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, пропускаем сохранение');
    return false;
  }
  
  try {
    const user = await sql`SELECT id FROM users WHERE chat_id = ${chatId}`;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO stickers (user_id, effect_applied, file_id, sticker_size)
        VALUES (${user[0].id}, ${effect}, ${fileId}, ${sizeBytes})
      `;
      
      await sql`
        UPDATE users 
        SET stickers_created = stickers_created + 1
        WHERE id = ${user[0].id}
      `;
      
      console.log(`✅ Стикер сохранен для ${chatId}`);
      return true;
    }
    
    console.log(`❌ Пользователь ${chatId} не найден`);
    return false;
  } catch (error) {
    console.error('❌ Ошибка saveSticker:', error.message);
    return false;
  }
}

// Создать подборку
async function createCollection(chatId, name) {
  console.log(`📁 Вызов createCollection: ${chatId}, "${name}"`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, пропускаем создание');
    return false;
  }
  
  try {
    const user = await sql`SELECT id FROM users WHERE chat_id = ${chatId}`;
    
    if (user.length > 0) {
      console.log(`✅ Подборка "${name}" создана (заглушка)`);
      return true;
    }
    
    console.log(`❌ Пользователь ${chatId} не найден`);
    return false;
  } catch (error) {
    console.error('❌ Ошибка createCollection:', error.message);
    return false;
  }
}

// Экспортируем все функции
module.exports = {
  initializeTables,
  saveUser,
  getUserStats,
  getTopUsers,
  saveSticker,
  createCollection
};

console.log('✅ database.js загружен, экспортировано функций:', Object.keys(module.exports).length);
