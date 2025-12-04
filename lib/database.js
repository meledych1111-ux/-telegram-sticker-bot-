// lib/database.js
const { neon } = require('@neondatabase/serverless');

let sql = null;

if (process.env.DATABASE_URL) {
  try {
    sql = neon(process.env.DATABASE_URL);
    console.log('✅ Neon подключен');
  } catch (error) {
    console.error('❌ Ошибка Neon:', error.message);
  }
}

module.exports = {
  // 📊 Получить статистику пользователя
  async getUserStats(chatId) {
    console.log(`📊 getUserStats вызван для ${chatId}`);
    
    if (!sql) {
      return {
        username: 'Тест',
        total_stickers: 0,
        registration_date: new Date()
      };
    }
    
    try {
      const result = await sql`
        SELECT username, stickers_created, registration_date 
        FROM users WHERE chat_id = ${chatId}
      `;
      
      if (result.length > 0) {
        return {
          username: result[0].username || 'Пользователь',
          total_stickers: result[0].stickers_created || 0,
          registration_date: result[0].registration_date
        };
      }
      
      return {
        username: 'Новый',
        total_stickers: 0,
        registration_date: new Date()
      };
    } catch (error) {
      console.error('❌ SQL ошибка:', error.message);
      return {
        username: 'Ошибка',
        total_stickers: 0,
        registration_date: new Date()
      };
    }
  },

  // 👤 Сохранить пользователя
  async saveUser(chatId, username, firstName) {
    console.log(`👤 saveUser: ${chatId}, ${username}`);
    
    if (!sql) return null;
    
    try {
      const result = await sql`
        INSERT INTO users (chat_id, username, first_name, last_activity)
        VALUES (${chatId}, ${username || ''}, ${firstName || ''}, NOW())
        ON CONFLICT (chat_id) DO UPDATE
        SET username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_activity = NOW()
        RETURNING id
      `;
      
      return result[0]?.id;
    } catch (error) {
      console.error('❌ Ошибка saveUser:', error.message);
      return null;
    }
  },
  
  // 🏆 Получить топ пользователей
  async getTopUsers(limit = 10) {
    console.log(`🏆 getTopUsers: лимит ${limit}`);
    
    if (!sql) return [];
    
    try {
      const result = await sql`
        SELECT username, stickers_created, chat_id
        FROM users WHERE stickers_created > 0
        ORDER BY stickers_created DESC LIMIT ${limit}
      `;
      
      return result.map((user, index) => ({
        rank: index + 1,
        username: user.username || `ID: ${user.chat_id}`,
        stickers_created: user.stickers_created || 0
      }));
    } catch (error) {
      console.error('❌ Ошибка getTopUsers:', error.message);
      return [];
    }
  },
  
  // 🎨 Сохранить стикер
  async saveSticker(chatId, fileId, effect = 'none', sizeBytes = 0) {
    console.log(`🎨 saveSticker: ${chatId}, эффект: ${effect}`);
    
    if (!sql) return false;
    
    try {
      const user = await sql`SELECT id FROM users WHERE chat_id = ${chatId}`;
      
      if (user.length > 0) {
        await sql`
          INSERT INTO stickers (user_id, effect_applied, file_id, sticker_size)
          VALUES (${user[0].id}, ${effect}, ${fileId}, ${sizeBytes})
        `;
        
        await sql`
          UPDATE users 
          SET stickers_created = stickers_created + 1
          WHERE id = ${user[0].id}
        `;
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Ошибка saveSticker:', error.message);
      return false;
    }
  }
};
