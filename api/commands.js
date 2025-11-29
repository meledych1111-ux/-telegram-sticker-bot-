import { sql } from '../lib/database.js';

export function getMainMenu() {
  return {
    reply_markup: {
      keyboard: [
        ['Создать стикер 🎨', 'Мои подборки 📂'],
        ['Избранное ⭐', 'Статистика 📊']
      ],
      resize_keyboard: true
    }
  };
}

export function getEffectsMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'None', callback_data: 'effect_none' },
          { text: 'Grayscale', callback_data: 'effect_grayscale' },
          { text: 'Sepia', callback_data: 'effect_sepia' }
        ],
        [
          { text: 'Vintage', callback_data: 'effect_vintage' },
          { text: 'Pixelate', callback_data: 'effect_pixelate' },
          { text: 'Blur', callback_data: 'effect_blur' }
        ]
      ]
    }
  };
}

export async function getUserStats(chatId) {
  const [{ stickers_created }] = await sql`SELECT stickers_created FROM users WHERE chat_id=${chatId}`;
  return stickers_created || 0;
}

export async function getTopUsers(limit=5) {
  return await sql`SELECT username, first_name, stickers_created FROM users WHERE stickers_created>0 ORDER BY stickers_created DESC LIMIT ${limit}`;
}

export async function getUserCollections(chatId) {
  return await sql`
    SELECT * FROM collections WHERE user_id = (SELECT id FROM users WHERE chat_id=${chatId}) ORDER BY created_at DESC`;
}

export async function deleteCollection(chatId, collectionId) {
  await sql`
    DELETE FROM collections
    WHERE id = ${collectionId} AND user_id = (SELECT id FROM users WHERE chat_id=${chatId})`;
}
