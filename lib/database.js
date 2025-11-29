// 🗄️  lib/database.js  –  минимальная и надёжная работа с БД
const postgres = require('postgres');
const sql = postgres(process.env.POSTGRES_URL, {
  ssl: 'require',
  idle_timeout: 20,
  max_lifetime: 60 * 30
});

let ready = false;

/*  📋  Инициализация таблиц  */
async function init() {
  if (ready) return;
  console.log('🔄  Инициализация БД...');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      chat_id     BIGINT UNIQUE NOT NULL,
      username    VARCHAR(255),
      first_name  VARCHAR(255),
      created_at  TIMESTAMP DEFAULT NOW(),
      last_active TIMESTAMP DEFAULT NOW(),
      stickers_created INT DEFAULT 0
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS stickers (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
      original_format VARCHAR(10),
      sticker_size   INTEGER,
      processing_time INTEGER,
      created_at     TIMESTAMP DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS collections (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      is_public   BOOLEAN DEFAULT false,
      created_at  TIMESTAMP DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS collection_stickers (
      id             SERIAL PRIMARY KEY,
      collection_id  INTEGER REFERENCES collections(id) ON DELETE CASCADE,
      sticker_data   TEXT NOT NULL,   -- file_id или base64
      added_at       TIMESTAMP DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS favorite_stickers (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
      sticker_data  TEXT NOT NULL,
      added_at      TIMESTAMP DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS effects (
      id          SERIAL PRIMARY KEY,
      name        VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    )`;

  await sql`
    INSERT INTO effects (name, description) VALUES
      ('none',      'Без эффекта'),
      ('vintage',   'Винтажный фильтр'),
      ('grayscale', 'Черно-белый'),
      ('sepia',     'Сепия'),
      ('pixelate',  'Пикселизация'),
      ('blur',      'Размытие')
    ON CONFLICT (name) DO NOTHING`;

  ready = true;
  console.log('✅  БД готова');
}

/*  -----  Пользователи  -----  */
async function saveUser(chatId, username, firstName) {
  await init();
  await sql`
    INSERT INTO users (chat_id, username, first_name, last_active)
    VALUES (${chatId}, ${username}, ${firstName}, NOW())
    ON CONFLICT (chat_id) DO UPDATE
    SET username     = EXCLUDED.username,
        first_name   = EXCLUDED.first_name,
        last_active  = NOW()`;
}

/*  -----  Стикеры  -----  */
async function saveSticker(chatId, format, size, time) {
  await init();
  const [user] = await sql`SELECT id FROM users WHERE chat_id = ${chatId}`;
  if (!user) return;

  await sql`
    INSERT INTO stickers (user_id, original_format, sticker_size, processing_time)
    VALUES (${user.id}, ${format}, ${size}, ${time})`;

  await sql`
    UPDATE users SET stickers_created = COALESCE(stickers_created,0)+1
    WHERE id = ${user.id}`;
}

/*  -----  Подборки  -----  */
async function createCollection(chatId, name, desc = '') {
  await init();
  const [user] = await sql`SELECT id FROM users WHERE chat_id = ${chatId}`;
  if (!user) throw new Error('Пользователь не найден');

  const [res] = await sql`
    INSERT INTO collections (user_id, name, description)
    VALUES (${user.id}, ${name}, ${desc}) RETURNING id`;
  return res;
}

async function deleteCollection(chatId, collectionId) {
  await init();
  await sql`
    DELETE FROM collections
    WHERE id = ${collectionId}
      AND user_id = (SELECT id FROM users WHERE chat_id = ${chatId})`;
}

async function getUserCollections(chatId) {
  await init();
  return await sql`
    SELECT c.*, COUNT(cs.id) AS stickers_count
    FROM collections c
    LEFT JOIN collection_stickers cs ON cs.collection_id = c.id
    WHERE c.user_id = (SELECT id FROM users WHERE chat_id = ${chatId})
    GROUP BY c.id
    ORDER BY c.created_at DESC`;
}

async function addStickerToCollection(collectionId, stickerData) {
  await init();
  await sql`
    INSERT INTO collection_stickers (collection_id, sticker_data)
    VALUES (${collectionId}, ${stickerData})`;
}

/*  -----  Избранное  -----  */
async function addToFavorites(chatId, stickerData) {
  await init();
  const [user] = await sql`SELECT id FROM users WHERE chat_id = ${chatId}`;
  if (!user) return;

  await sql`
    INSERT INTO favorite_stickers (user_id, sticker_data)
    VALUES (${user.id}, ${stickerData})`;
}

async function getUserFavorites(chatId) {
  await init();
  return await sql`
    SELECT * FROM favorite_stickers
    WHERE user_id = (SELECT id FROM users WHERE chat_id = ${chatId})
    ORDER BY added_at DESC`;
}

/*  -----  Эффекты  -----  */
async function getAvailableEffects() {
  await init();
  return await sql`SELECT * FROM effects ORDER BY name`;
}

/*  -----  Статистика  -----  */
async function getUserStats(chatId) {
  await init();
  const [user] = await sql`SELECT id, stickers_created FROM users WHERE chat_id = ${chatId}`;
  if (!user) return { total: 0, today: 0, collections: 0, favorites: 0 };

  const [{ today }] = await sql`
    SELECT COUNT(*) AS today FROM stickers
    WHERE user_id = ${user.id} AND DATE(created_at) = CURRENT_DATE`;

  const [{ collections }] = await sql`
    SELECT COUNT(*) AS collections FROM collections WHERE user_id = ${user.id}`;

  const [{ favorites }] = await sql`
    SELECT COUNT(*) AS favorites FROM favorite_stickers WHERE user_id = ${user.id}`;

  return {
    total: user.stickers_created || 0,
    today: today || 0,
    collections: collections || 0,
    favorites: favorites || 0
  };
}

async function getTopUsers(limit = 5) {
  await init();
  return await sql`
    SELECT username, first_name, stickers_created
    FROM users
    WHERE stickers_created > 0
    ORDER BY stickers_created DESC
    LIMIT ${limit}`;
}

async function getUserCount() {
  await init();
  const [{ count }] = await sql`SELECT COUNT(*) AS count FROM users`;
  return +count;
}

module.exports = {
  saveUser,
  saveSticker,
  getUserStats,
  getTopUsers,
  getUserCount,
  createCollection,
  deleteCollection,
  addStickerToCollection,
  addToFavorites,
  getUserCollections,
  getUserFavorites,
  getAvailableEffects
};
