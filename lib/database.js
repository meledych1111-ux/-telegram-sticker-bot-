// lib/database.js - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ
console.log('📦 Загрузка database.js...');

const { neon } = require('@neondatabase/serverless');

// Проверяем переменные окружения
console.log('🔍 Проверка окружения:');
console.log('   • DATABASE_URL:', process.env.DATABASE_URL ? '✅ Установлен' : '❌ НЕТ');
console.log('   • NODE_ENV:', process.env.NODE_ENV || 'development');

let sql = null;

// Подключаемся к Neon если есть DATABASE_URL
if (process.env.DATABASE_URL) {
  try {
    sql = neon(process.env.DATABASE_URL);
    console.log('✅ Neon PostgreSQL подключен');
  } catch (error) {
    console.error('❌ Ошибка подключения к Neon:', error.message);
  }
} else {
  console.log('⚠️ DATABASE_URL не установлен, работаем без базы данных');
}

// 🗄️ Инициализация таблиц
async function initializeTables() {
  if (!sql) {
    console.log('⚠️ База не подключена, пропускаем инициализацию');
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

    console.log('✅ Таблицы базы данных созданы');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error.message);
  }
}

// 👤 Регистрация/обновление пользователя
async function saveUser(chatId, username, firstName) {
  console.log(`👤 Вызов saveUser: chatId=${chatId}, username=${username}`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, пропускаем сохранение');
    return null;
  }
  
  try {
    const result = await sql`
      INSERT INTO users (
        chat_id, 
        username, 
        first_name, 
        last_activity
      ) 
      VALUES (
        ${chatId}, 
        ${username || ''}, 
        ${firstName || ''}, 
        NOW()
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
  console.log(`🎨 Вызов saveSticker: chatId=${chatId}, effect=${effect}`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, пропускаем сохранение');
    return false;
  }
  
  try {
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO stickers (
          user_id, 
          effect_applied, 
          file_id, 
          sticker_size
        )
        VALUES (
          ${user[0].id}, 
          ${effect}, 
          ${fileId}, 
          ${sizeBytes}
        )
      `;
      
      // Увеличиваем счетчик стикеров
      await sql`
        UPDATE users 
        SET 
          stickers_created = stickers_created + 1,
          last_activity = NOW()
        WHERE id = ${user[0].id}
      `;
      
      console.log(`✅ Стикер сохранен с эффектом: ${effect}`);
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
  console.log(`📊 Вызов getUserStats для chatId=${chatId}`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, возвращаю тестовые данные');
    return {
      username: 'Пользователь',
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
  console.log(`🏆 Вызов getTopUsers, лимит=${limit}`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, возвращаю тестовый топ');
    return [
      { username: 'user1', stickers_created: 10, rank: 1 },
      { username: 'user2', stickers_created: 5, rank: 2 },
      { username: 'user3', stickers_created: 3, rank: 3 }
    ];
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
  console.log(`📁 Вызов createCollection: chatId=${chatId}, name="${name}"`);
  
  if (!sql) {
    console.log('⚠️ База не подключена, пропускаем создание');
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
    
    // Простая версия - просто логируем
    console.log(`✅ Подборка "${name}" создана (заглушка)`);
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
    const [totalUsers, totalStickers] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM users`,
      sql`SELECT COUNT(*) as count FROM stickers`
    ]);
    
    return {
      total_users: Number(totalUsers[0]?.count) || 0,
      total_stickers: Number(totalStickers[0]?.count) || 0
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики бота:', error.message);
    return {
      total_users: 0,
      total_stickers: 0
    };
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
  
  // Утилиты
  checkConnection,
  
  // SQL клиент (для отладки)
  sql
};

console.log('✅ database.js загружен, экспортировано функций:', Object.keys(module.exports).length);
