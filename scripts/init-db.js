#!/usr/bin/env node

import postgres from 'postgres';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';

dotenv.config();

const neonUrl = process.env.NEON_DATABASE_URL;

if (!neonUrl) {
  console.error('❌ NEON_DATABASE_URL не установлен');
  console.log('ℹ️  Получите строку подключения на neon.tech');
  process.exit(1);
}

async function initDatabase() {
  console.log('🔧 Инициализация базы данных Neon PostgreSQL\n');
  
  let sql;
  
  try {
    sql = postgres(neonUrl, {
      ssl: 'require',
      max: 5
    });
    
    // Проверка подключения
    await sql`SELECT 1`;
    console.log('✅ Подключение к базе данных успешно');
    
    // Создание таблиц
    console.log('\n📝 Создание таблиц...');
    
    // Пользователи
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        language_code VARCHAR(10),
        is_premium BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Таблица users создана');
    
    // Стикеры
    await sql`
      CREATE TABLE IF NOT EXISTS stickers (
        id VARCHAR(21) PRIMARY KEY DEFAULT ${nanoid()},
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        telegram_file_id VARCHAR(255),
        file_unique_id VARCHAR(255) UNIQUE,
        file_size INTEGER,
        effect VARCHAR(100),
        frame_type VARCHAR(50),
        text_overlay TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        processing_time INTEGER,
        original_format VARCHAR(10),
        error_message TEXT
      )
    `;
    console.log('✅ Таблица stickers создана');
    
    // Статистика пользователей
    await sql`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        stickers_created INTEGER DEFAULT 0,
        photos_processed INTEGER DEFAULT 0,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        favorite_effect VARCHAR(100),
        total_processing_time INTEGER DEFAULT 0
      )
    `;
    console.log('✅ Таблица user_stats создана');
    
    // Эффекты
    await sql`
      CREATE TABLE IF NOT EXISTS effects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        category VARCHAR(50),
        popularity INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Таблица effects создана');
    
    // Вставляем базовые эффекты
    await sql`
      INSERT INTO effects (name, description, category) VALUES
        ('none', 'Без эффекта', 'basic'),
        ('rounded', 'Закругленные углы', 'frames'),
        ('circle', 'Круглая обрезка', 'frames'),
        ('border', 'Белая рамка', 'frames'),
        ('grayscale', 'Черно-белый', 'filters'),
        ('sepia', 'Сепия', 'filters'),
        ('vibrant', 'Яркие цвета', 'filters'),
        ('blur', 'Размытие фона', 'effects'),
        ('pixelate', 'Пикселизация', 'effects')
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('✅ Базовые эффекты добавлены');
    
    // Индексы
    console.log('\n📊 Создание индексов...');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stickers_user_id ON stickers(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stickers_created_at ON stickers(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_stats_last_activity ON user_stats(last_activity)`;
    
    console.log('✅ Индексы созданы');
    
    // Проверяем созданные таблицы
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('\n📋 Созданные таблицы:');
    tables.forEach(table => console.log(`  • ${table.table_name}`));
    
    // Статистика базы данных
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM stickers) as stickers_count,
        (SELECT COUNT(*) FROM effects) as effects_count
    `.then(rows => rows[0]);
    
    console.log(`\n📊 Статистика базы данных:`);
    console.log(`   👥 Пользователи: ${stats.users_count}`);
    console.log(`   🎨 Стикеры: ${stats.stickers_count}`);
    console.log(`   ✨ Эффекты: ${stats.effects_count}`);
    
    console.log('\n🎉 Инициализация базы данных завершена успешно!');
    
  } catch (error) {
    console.error(`\n❌ Ошибка инициализации базы данных: ${error.message}`);
    console.error(`Стек: ${error.stack}`);
    process.exit(1);
  } finally {
    if (sql) {
      await sql.end();
    }
  }
}

// Запуск
initDatabase();
