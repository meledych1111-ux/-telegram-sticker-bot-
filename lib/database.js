// lib/database.js
import { neon } from '@neondatabase/serverless';

class Database {
  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    this.sql = neon(process.env.DATABASE_URL);
  }

  /**
   * Сохраняет пользователя в базу данных
   */
  async saveUser(telegramId, username, firstName, lastName = null) {
    try {
      const result = await this.sql`
        INSERT INTO users (
          telegram_id, 
          username, 
          first_name, 
          last_name,
          created_at,
          updated_at
        ) 
        VALUES (
          ${telegramId},
          ${username},
          ${firstName},
          ${lastName},
          NOW(),
          NOW()
        )
        ON CONFLICT (telegram_id) 
        DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          updated_at = NOW()
        RETURNING id;
      `;
      
      return result[0]?.id;
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  /**
   * Получает пользователя по Telegram ID
   */
  async getUser(telegramId) {
    try {
      const result = await this.sql`
        SELECT * FROM users 
        WHERE telegram_id = ${telegramId} 
        LIMIT 1;
      `;
      
      return result[0] || null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Сохраняет запись о действии пользователя
   */
  async saveAction(userId, actionType, data = {}) {
    try {
      const result = await this.sql`
        INSERT INTO user_actions (
          user_id,
          action_type,
          data,
          created_at
        )
        VALUES (
          ${userId},
          ${actionType},
          ${JSON.stringify(data)},
          NOW()
        )
        RETURNING id;
      `;
      
      return result[0]?.id;
    } catch (error) {
      console.error('Error saving action:', error);
      throw error;
    }
  }

  /**
   * Получает статистику пользователя
   */
  async getUserStats(userId) {
    try {
      const result = await this.sql`
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          MIN(created_at) as first_action,
          MAX(created_at) as last_action
        FROM user_actions 
        WHERE user_id = ${userId};
      `;
      
      return result[0];
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Создает необходимые таблицы (для инициализации)
   */
  async initDatabase() {
    try {
      // Создаем таблицу пользователей
      await this.sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          telegram_id BIGINT UNIQUE NOT NULL,
          username VARCHAR(255),
          first_name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // Создаем таблицу действий пользователей
      await this.sql`
        CREATE TABLE IF NOT EXISTS user_actions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          action_type VARCHAR(100) NOT NULL,
          data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // Создаем индекс для быстрого поиска
      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_user_actions_user_id 
        ON user_actions(user_id);
      `;

      await this.sql`
        CREATE INDEX IF NOT EXISTS idx_user_actions_created_at 
        ON user_actions(created_at);
      `;

      console.log('✅ Database tables created or already exist');
      return true;
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }
}

// Экспортируем singleton экземпляр
let databaseInstance = null;

export function getDatabase() {
  if (!databaseInstance) {
    databaseInstance = new Database();
  }
  return databaseInstance;
}

// Экспортируем отдельные методы для удобства
export const database = {
  saveUser: async (...args) => {
    const db = getDatabase();
    return db.saveUser(...args);
  },
  
  getUser: async (...args) => {
    const db = getDatabase();
    return db.getUser(...args);
  },
  
  saveAction: async (...args) => {
    const db = getDatabase();
    return db.saveAction(...args);
  },
  
  getUserStats: async (...args) => {
    const db = getDatabase();
    return db.getUserStats(...args);
  },
  
  initDatabase: async () => {
    const db = getDatabase();
    return db.initDatabase();
  }
};
