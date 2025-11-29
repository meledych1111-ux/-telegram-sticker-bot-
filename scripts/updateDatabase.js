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

    // Таблица пользователей (без premium_level)
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

    // Таблица стикеров (без effect_applied)
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

    // Таблица подборок
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
    console.log('✅ Таблица collections создана');

    // Таблица стикеров в подборках
    await sql`
      CREATE TABLE IF NOT EXISTS collection_stickers (
        id SERIAL PRIMARY KEY,
        collection_id INTEGER,
        sticker_data TEXT,
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Таблица collection_stickers создана');

    // Таблица избранных стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS favorite_stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        sticker_data TEXT,
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Таблица favorite_stickers создана');

    // Таблица эффектов (без is_premium)
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
      ('pixelate', 'Пикселизация'),
      ('blur', 'Размытие')
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

// 📊 ПРОВЕРКА СТРУКТУРЫ БАЗЫ
async function checkDatabase() {
  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL не установлен');
    return;
  }

  let sql;
  try {
    console.log('🔍 Проверяю структуру базы данных...');
    sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('\n📋 СТРУКТУРА БАЗЫ ДАННЫХ:');
    console.log(`📊 Найдено таблиц: ${tables.length}`);
    
    tables.forEach(table => {
      console.log(`   📄 ${table.table_name}`);
    });

    // Проверяем количество записей
    for (let table of tables) {
      const count = await sql`SELECT COUNT(*) as count FROM ${sql(table.table_name)}`;
      console.log(`   📊 ${table.table_name}: ${count[0].count} записей`);
    }

  } catch (error) {
    console.error('❌ Ошибка проверки базы:', error.message);
  } finally {
    if (sql) await sql.end();
  }
}

// Автоматически запускаем если файл вызван напрямую
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
      checkDatabase();
      break;
    case 'update':
    default:
      updateDatabase();
      break;
  }
}

module.exports = {
  updateDatabase,
  checkDatabase
};
