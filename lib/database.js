import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL, { ssl: 'require' });
let ready = false;

export async function init() {
  if (ready) return;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT UNIQUE NOT NULL,
      username VARCHAR(255),
      first_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      last_active TIMESTAMP DEFAULT NOW(),
      stickers_created INT DEFAULT 0
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS stickers (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      effect VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS collections (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS collection_stickers (
      id SERIAL PRIMARY KEY,
      collection_id INT REFERENCES collections(id) ON DELETE CASCADE,
      sticker_id INT REFERENCES stickers(id) ON DELETE CASCADE
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS favorite_stickers (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      sticker_id INT REFERENCES stickers(id) ON DELETE CASCADE
    )`;

  ready = true;
}

export { sql };
