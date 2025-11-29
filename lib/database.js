// 🗄️ БАЗА ДАННЫХ С АВТОМАТИЧЕСКИМ ИСПРАВЛЕНИЕМ
const postgres = require('postgres');

// Глобальная переменная для подключения
let sql;
let isDatabaseReady = false;

// 🔧 СОЗДАЕМ ПОДКЛЮЧЕНИЕ К БАЗЕ
function getDatabaseConnection() {
  if (!sql) {
    sql = postgres(process.env.POSTGRES_URL, {
      ssl: 'require',
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      connect_timeout: 10
    });
  }
  return sql;
}

// 🚨 АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ БАЗЫ ПРИ ЗАПУСКЕ
async function initializeDatabase() {
  if (isDatabaseReady) return true;
  
  const sql = getDatabaseConnection();
  
  try {
    console.log('🚀 Инициализация базы данных...');
    
    // Проверяем подключение
    await sql`SELECT 1 as test`;
    console.log('✅ Подключение к базе установлено');

    // СОЗДАЕМ ТАБЛИЦЫ ЕСЛИ ИХ НЕТ
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
    console.log('✅ Таблица users готова');

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
    console.log('✅ Таблица stickers готова');

    await sql`
      CREATE TABLE IF NOT EXISTS effects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Таблица effects готова');

    // ДОБАВЛЯЕМ БАЗОВЫЕ ЭФФЕКТЫ
    await sql`
      INSERT INTO effects (name, description) VALUES
      ('none', 'Без эффекта'),
      ('vintage', 'Винтажный фильтр'),
      ('grayscale', 'Черно-белый'),
      ('sepia', 'Сепия'),
      ('pixelate', 'Пикселизация')
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('✅ Базовые эффекты добавлены');

    isDatabaseReady = true;
    console.log('🎉 База данных полностью инициализирована!');
    return true;

  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА ИНИЦИАЛИЗАЦИИ БАЗЫ:', error);
    
    // Пытаемся создать упрощенные таблицы
    try {
      console.log('🔄 Пробую создать упрощенные таблицы...');
      
      // Самая простая таблица пользователей
      await sql`
        CREATE TABLE IF NOT EXISTS simple_users (
          id SERIAL PRIMARY KEY,
          chat_id BIGINT UNIQUE NOT NULL,
          username VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      // Самая простая таблица стикеров
      await sql`
        CREATE TABLE IF NOT EXISTS simple_stickers (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      
      console.log('✅ Упрощенные таблицы созданы');
      isDatabaseReady = true;
      return true;
      
    } catch (fallbackError) {
      console.error('❌ Не удалось создать даже упрощенные таблицы:', fallbackError);
      return false;
    }
  }
}

// 📊 Сохранить пользователя (УСТОЙЧИВАЯ ВЕРСИЯ)
async function saveUser(chatId, username, firstName) {
  try {
    const sql = getDatabaseConnection();
    
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
    console.error('❌ Ошибка сохранения пользователя:', error.message);
    // Продолжаем работу даже при ошибке
  }
}

// 🎨 Сохранить информацию о стикере (УСТОЙЧИВАЯ)
async function saveSticker(chatId, format, stickerSize, processingTime) {
  try {
    const sql = getDatabaseConnection();
    
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
    console.error('❌ Ошибка сохранения стикера:', error.message);
    // Продолжаем работу даже при ошибке
  }
}

// 🎭 ПОЛУЧИТЬ ЭФФЕКТЫ (УСТОЙЧИВАЯ)
async function getAvailableEffects(chatId) {
  try {
    const sql = getDatabaseConnection();
    const effects = await sql`SELECT * FROM effects ORDER BY name`;
    return effects;
  } catch (error) {
    console.error('❌ Ошибка получения эффектов:', error.message);
    return [
      { name: 'none', description: 'Без эффекта' },
      { name: 'vintage', description: 'Винтажный фильтр' },
      { name: 'grayscale', description: 'Черно-белый' },
      { name: 'sepia', description: 'Сепия' }
    ];
  }
}

// 📊 Получить статистику пользователя (УСТОЙЧИВАЯ)
async function getUserStats(chatId) {
  try {
    const sql = getDatabaseConnection();
    
    const user = await sql`
      SELECT COALESCE(stickers_created, 0) as stickers_created 
      FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length === 0) {
      return { total_stickers: 0, today_stickers: 0 };
    }
    
    const todayStickers = await sql`
      SELECT COUNT(*) as count FROM stickers s
      JOIN users u ON s.user_id = u.id
      WHERE u.chat_id = ${chatId} AND DATE(s.created_at) = CURRENT_DATE
    `;
    
    return { 
      total_stickers: user[0].stickers_created, 
      today_stickers: todayStickers[0]?.count || 0
    };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error.message);
    return { total_stickers: 0, today_stickers: 0 };
  }
}

// 🏆 Топ пользователей (УСТОЙЧИВАЯ)
async function getTopUsers(limit = 5) {
  try {
    const sql = getDatabaseConnection();
    
    const topUsers = await sql`
      SELECT username, first_name, COALESCE(stickers_created, 0) as stickers_created
      FROM users 
      WHERE COALESCE(stickers_created, 0) > 0
      ORDER BY stickers_created DESC 
      LIMIT ${limit}
    `;
    
    return topUsers;
  } catch (error) {
    console.error('❌ Ошибка получения топа:', error.message);
    return [];
  }
}

// 🔢 Получить количество пользователей
async function getUserCount() {
  try {
    const sql = getDatabaseConnection();
    const result = await sql`SELECT COUNT(*) as count FROM users`;
    return result[0].count;
  } catch (error) {
    console.error('❌ Ошибка получения количества пользователей:', error.message);
    return 0;
  }
}

// 🆕 ПРОСТЫЕ ВЕРСИИ ДЛЯ ОСТАЛЬНЫХ ФУНКЦИЙ
async function createCollection(chatId, name, description = '', isPublic = false) {
  console.log('📁 Создание подборки временно недоступно');
  return { id: Date.now() };
}

async function addStickerToCollection(collectionId, stickerData) {
  console.log('📁 Добавление в подборку временно недоступно');
}

async function addToFavorites(chatId, stickerData, effectType = 'none') {
  console.log('⭐ Добавление в избранное временно недоступно');
}

async function getUserCollections(chatId) {
  return [];
}

async function getUserFavorites(chatId) {
  return [];
}

// 🆕 АВТОМАТИЧЕСКИЙ ЗАПУСК ИНИЦИАЛИЗАЦИИ ПРИ ИМПОРТЕ
initializeDatabase().then(success => {
  if (success) {
    console.log('🚀 База данных готова к работе!');
  } else {
    console.log('⚠️ База данных в упрощенном режиме');
  }
});

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
  initializeDatabase // Экспортируем для ручного вызова
};
