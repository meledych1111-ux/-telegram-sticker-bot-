// 🔄 СКРИПТ ДЛЯ ОБНОВЛЕНИЯ БАЗЫ ДАННЫХ
const postgres = require('postgres');

async function updateDatabase() {
  // Проверяем наличие POSTGRES_URL
  if (!process.env.POSTGRES_URL) {
    console.error('❌ ОШИБКА: POSTGRES_URL не установлен');
    console.log('💡 Решение: Добавьте POSTGRES_URL в Vercel Dashboard → Settings → Environment Variables');
    console.log('   Получите URL из Vercel Storage → PostgreSQL');
    process.exit(1);
  }

  let sql;
  try {
    console.log('🔗 Подключаюсь к базе данных...');
    sql = postgres(process.env.POSTGRES_URL, {
      ssl: 'require',
      idle_timeout: 20
    });

    // Проверяем подключение
    await sql`SELECT 1 as test`;
    console.log('✅ Подключение к базе данных успешно!');

    console.log('\n🔄 Создаю таблицы...');

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
    console.log('✅ Таблица users создана');

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
    console.log('✅ Таблица stickers создана');

    // Таблица эффектов
    await sql`
      CREATE TABLE IF NOT EXISTS effects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Таблица effects создана');

    // Базовые эффекты
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

    console.log('\n🎉 БАЗА ДАННЫХ УСПЕШНО ОБНОВЛЕНА!');
    console.log('✨ Теперь можно использовать бота');

  } catch (error) {
    console.error('\n❌ ОШИБКА ОБНОВЛЕНИЯ БАЗЫ:');
    console.error('   💥', error.message);
    
    console.log('\n💡 РЕШЕНИЕ:');
    console.log('   1. Проверьте POSTGRES_URL в Environment Variables');
    console.log('   2. Убедитесь что база данных активна в Vercel Storage');
    console.log('   3. Запустите бота - он создаст таблицы автоматически');
    
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
      console.log('\n🔌 Подключение закрыто');
    }
  }
}

if (require.main === module) {
  updateDatabase();
}

module.exports = updateDatabase;
