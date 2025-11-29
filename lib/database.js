// 🗄️ БАЗА ДАННЫХ С АВТОМАТИЧЕСКИМ СОЗДАНИЕМ ТАБЛИЦ
const postgres = require('postgres');

// Создаем подключение
const sql = postgres(process.env.POSTGRES_URL, {
  ssl: 'require',
  idle_timeout: 20,
  max_lifetime: 60 * 30
});

// Флаг чтобы не создавать таблицы много раз
let tablesInitialized = false;

// 📋 Функция для создания таблиц
async function initializeTables() {
  if (tablesInitialized) return;
  
  try {
    console.log('🗄️ Создаю таблицы в базе данных...');
    
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
      );
    `;
    console.log('✅ Таблица users создана');

    // Таблица стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        original_format VARCHAR(10),
        sticker_size INTEGER,
        processing_time INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    console.log('✅ Таблица stickers создана');
    
    tablesInitialized = true;
    console.log('🎉 Все таблицы готовы!');
    
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error);
  }
}

// 📊 Сохранить пользователя
async function saveUser(chatId, username, firstName) {
  try {
    // Гарантируем что таблицы существуют
    await initializeTables();
    
    await sql`
      INSERT INTO users (chat_id, username, first_name, last_active) 
      VALUES (${chatId}, ${username}, ${firstName}, NOW())
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        username = ${username},
        first_name = ${firstName}, 
        last_active = NOW(),
        stickers_created = users.stickers_created + 1
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
    
    const users = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (users.length > 0) {
      await sql`
        INSERT INTO stickers (user_id, original_format, sticker_size, processing_time)
        VALUES (${users[0].id}, ${format}, ${stickerSize}, ${processingTime})
      `;
      console.log('✅ Стикер сохранен в базу');
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения стикера:', error);
  }
}

// 📈 Получить статистику пользователя
async function getUserStats(chatId) {
  try {
    await initializeTables();
    
    const stats = await sql`
      SELECT 
        u.stickers_created as total_stickers,
        COUNT(s.id) as today_stickers
      FROM users u
      LEFT JOIN stickers s ON u.id = s.user_id AND DATE(s.created_at) = CURRENT_DATE
      WHERE u.chat_id = ${chatId}
      GROUP BY u.id, u.stickers_created
    `;
    
    return stats[0] || { total_stickers: 0, today_stickers: 0 };
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    return { total_stickers: 0, today_stickers: 0 };
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

// 🔢 Получить количество пользователей (для тестирования)
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

// Экспортируем функции
module.exports = {
  saveUser,
  saveSticker,
  getUserStats,
  getTopUsers,
  getUserCount,
  initializeTables
};
