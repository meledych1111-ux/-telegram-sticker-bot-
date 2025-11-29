// 🔄  scripts/updateDatabase.js – однократная инициализация / миграция
require('dotenv').config();
const postgres = require('postgres');

if (!process.env.POSTGRES_URL) {
  console.error('❌  POSTGRES_URL не установлен');
  process.exit(1);
}

const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require', idle_timeout: 20 });

(async () => {
  console.log('🔄  Создаю / обновляю таблицы...');

  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, chat_id BIGINT UNIQUE NOT NULL, username VARCHAR(255),
    first_name VARCHAR(255), created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(), stickers_created INT DEFAULT 0)`;

  await sql`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='stickers' AND column_name='processing_time' AND data_type='integer') THEN
    ALTER TABLE stickers ALTER COLUMN processing_time TYPE BIGINT USING processing_time::BIGINT; END IF; END $$`;

  await sql`CREATE TABLE IF NOT EXISTS stickers (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_format VARCHAR(10), sticker_size INTEGER, processing_time BIGINT,
    created_at TIMESTAMP DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, description TEXT, is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS collection_stickers (
    id SERIAL PRIMARY KEY, collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
    sticker_data TEXT NOT NULL, added_at TIMESTAMP DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS favorite_stickers (
    id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    sticker_data TEXT NOT NULL, added_at TIMESTAMP DEFAULT NOW())`;

  await sql`CREATE TABLE IF NOT EXISTS effects (
    id SERIAL PRIMARY KEY, name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT, created_at TIMESTAMP DEFAULT NOW())`;

  await sql`INSERT INTO effects (name, description) VALUES
    ('none','Без эффекта'),('vintage','Винтажный фильтр'),('grayscale','Черно-белый'),
    ('sepia','Сепия'),('pixelate','Пикселизация'),('blur','Размытие')
    ON CONFLICT (name) DO NOTHING`;

  console.log('✅  Таблицы готовы');
  await sql.end();
})().catch(e => {
  console.error('❌ ', e);
  process.exit(1);
});
