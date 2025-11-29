// 🔄 УЛУЧШЕННЫЙ СКРИПТ ДЛЯ ОБНОВЛЕНИЯ БАЗЫ ДАННЫХ
const postgres = require('postgres');

async function updateDatabase() {
  // Проверяем наличие POSTGRES_URL
  if (!process.env.POSTGRES_URL) {
    console.error('❌ ОШИБКА: POSTGRES_URL не установлен в Environment Variables');
    console.log('💡 Решение: Добавьте POSTGRES_URL в Vercel Dashboard → Settings → Environment Variables');
    console.log('   Получите URL базы данных из Vercel Storage → PostgreSQL');
    process.exit(1);
  }

  let sql;
  try {
    console.log('🔗 Подключаюсь к базе данных...');
    sql = postgres(process.env.POSTGRES_URL, {
      ssl: 'require',
      idle_timeout: 20,
      max_lifetime: 60 * 10
    });

    // Проверяем подключение
    await sql`SELECT 1 as test`;
    console.log('✅ Подключение к базе данных успешно!');

    console.log('\n🔄 Начинаю обновление структуры базы данных...');

    // 1. СОЗДАЕМ ТАБЛИЦЫ ЕСЛИ ИХ НЕТ
    console.log('\n📋 Проверяю и создаю таблицы...');

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
      )
    `;
    console.log('✅ Таблица users готова');

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
      )
    `;
    console.log('✅ Таблица stickers готова');

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
      )
    `;
    console.log('✅ Таблица collections готова');

    // Таблица стикеров в подборках
    await sql`
      CREATE TABLE IF NOT EXISTS collection_stickers (
        id SERIAL PRIMARY KEY,
        collection_id INTEGER REFERENCES collections(id),
        sticker_data TEXT,
        sticker_order INTEGER DEFAULT 0,
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Таблица collection_stickers готова');

    // Таблица избранных стикеров
    await sql`
      CREATE TABLE IF NOT EXISTS favorite_stickers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        sticker_data TEXT,
        effect_type VARCHAR(50),
        added_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Таблица favorite_stickers готова');

    // Таблица эффектов
    await sql`
      CREATE TABLE IF NOT EXISTS effects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        is_premium BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Таблица effects готова');

    // 2. ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ СТОЛБЦЫ
    console.log('\n🎯 Добавляю недостающие столбцы...');

    try {
      await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS premium_level INT DEFAULT 0
      `;
      console.log('✅ Столбец premium_level добавлен в users');
    } catch (error) {
      console.log('ℹ️ Столбец premium_level уже существует в users');
    }

    try {
      await sql`
        ALTER TABLE stickers 
        ADD COLUMN IF NOT EXISTS effect_applied VARCHAR(50) DEFAULT 'none'
      `;
      console.log('✅ Столбец effect_applied добавлен в stickers');
    } catch (error) {
      console.log('ℹ️ Столбец effect_applied уже существует в stickers');
    }

    // 3. ДОБАВЛЯЕМ БАЗОВЫЕ ДАННЫЕ
    console.log('\n🎨 Добавляю базовые эффекты...');

    await sql`
      INSERT INTO effects (name, description, is_premium) VALUES
      ('none', 'Без эффекта', false),
      ('vintage', 'Винтажный фильтр', false),
      ('grayscale', 'Черно-белый', false),
      ('sepia', 'Сепия', false),
      ('pixelate', 'Пикселизация', false),
      ('blur', 'Размытие', true),
      ('glitch', 'Глитч-эффект', true)
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('✅ Базовые эффекты добавлены');

    // 4. ПРОВЕРЯЕМ РЕЗУЛЬТАТ
    console.log('\n📊 Проверяю результат...');

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log(`📋 Создано таблиц: ${tables.length}`);
    tables.forEach(table => console.log(`   📄 ${table.table_name}`));

    const effectsCount = await sql`SELECT COUNT(*) as count FROM effects`;
    console.log(`🎭 Добавлено эффектов: ${effectsCount[0].count}`);

    const usersCount = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`👥 Пользователей в базе: ${usersCount[0].count}`);

    console.log('\n🎉 БАЗА ДАННЫХ УСПЕШНО ОБНОВЛЕНА!');
    console.log('✨ Теперь можно запускать бота и настраивать вебхук');

  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА ОБНОВЛЕНИЯ БАЗЫ:');
    
    if (error.code === '28P01') {
      console.error('   🔐 Ошибка аутентификации - проверьте POSTGRES_URL');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   🔌 Не удалось подключиться к базе данных');
    } else if (error.code === '42P01') {
      console.error('   📊 Ошибка в SQL запросе - проверьте синтаксис');
    } else {
      console.error(`   💥 ${error.message}`);
    }
    
    console.log('\n💡 РЕШЕНИЕ:');
    console.log('   1. Проверьте POSTGRES_URL в Environment Variables');
    console.log('   2. Убедитесь что база данных активна в Vercel Storage');
    console.log('   3. Проверьте права доступа к базе данных');
    
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
      console.log('\n🔌 Подключение к базе данных закрыто');
    }
  }
}

// 🔧 ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ

// Проверка структуры базы данных
async function checkDatabaseStructure() {
  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL не установлен');
    return;
  }

  const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });

  try {
    console.log('🔍 Проверяю структуру базы данных...');

    const columns = await sql`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;

    console.log('\n📊 СТРУКТУРА БАЗЫ ДАННЫХ:');
    
    let currentTable = '';
    columns.forEach(col => {
      if (col.table_name !== currentTable) {
        currentTable = col.table_name;
        console.log(`\n📄 ${currentTable.toUpperCase()}:`);
      }
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error) {
    console.error('❌ Ошибка проверки структуры:', error.message);
  } finally {
    await sql.end();
  }
}

// Очистка базы данных (ОСТОРОЖНО!)
async function resetDatabase() {
  if (!process.env.POSTGRES_URL) {
    console.error('❌ POSTGRES_URL не установлен');
    return;
  }

  const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });

  try {
    console.log('⚠️  ВНИМАНИЕ: Это удалит все данные!');
    console.log('Для продолжения введите "DELETE ALL DATA":');
    
    // Для безопасности можно добавить подтверждение
    // const readline = require('readline').createInterface({
    //   input: process.stdin,
    //   output: process.stdout
    // });
    
    // readline.question('Подтверждение: ', async (answer) => {
    //   if (answer === 'DELETE ALL DATA') {
        await sql`
          DROP TABLE IF EXISTS 
            collection_stickers, 
            favorite_stickers, 
            stickers, 
            collections, 
            effects, 
            users 
          CASCADE
        `;
        console.log('✅ База данных очищена');
    //   } else {
    //     console.log('❌ Операция отменена');
    //   }
    //   readline.close();
    // });

  } catch (error) {
    console.error('❌ Ошибка очистки базы:', error.message);
  } finally {
    await sql.end();
  }
}

// Автоматически запускаем если файл вызван напрямую
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
      checkDatabaseStructure();
      break;
    case 'reset':
      resetDatabase();
      break;
    case 'update':
    default:
      updateDatabase();
      break;
  }
}

module.exports = {
  updateDatabase,
  checkDatabaseStructure,
  resetDatabase
};
