// 🔄 СКРИПТ ДЛЯ ОБНОВЛЕНИЯ БАЗЫ ДАННЫХ
const postgres = require('postgres');

const sql = postgres(process.env.POSTGRES_URL, {
  ssl: 'require'
});

async function updateDatabase() {
  try {
    console.log('🔄 Обновляю структуру базы данных...');

    // Добавляем недостающие столбцы
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS premium_level INT DEFAULT 0
    `;
    console.log('✅ Добавлен столбец premium_level в users');

    await sql`
      ALTER TABLE stickers 
      ADD COLUMN IF NOT EXISTS effect_applied VARCHAR(50) DEFAULT 'none'
    `;
    console.log('✅ Добавлен столбец effect_applied в stickers');

    console.log('🎉 База данных обновлена!');
    
  } catch (error) {
    console.error('❌ Ошибка обновления базы:', error);
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  updateDatabase();
}

module.exports = updateDatabase;
