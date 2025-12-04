// 🔗 НАСТРОЙКА ВЕБХУКА ДЛЯ TELEGRAM BOT API (Node.js 24 + Neon)
async function setupWebhook() {
  // Получаем переменные из окружения
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const VERCEL_URL = process.env.VERCEL_URL;
  
  // Переменные Neon из вашего списка
  const DATABASE_URL = process.env.DATABASE_URL;
  const PGHOST_UNPOOLED = process.env.PGHOST_UNPOOLED;
  const PGUSER = process.env.PGUSER;
  const PGDATABASE = process.env.PGDATABASE;
  
  const { setTimeout } = require('node:timers/promises');

  console.log('🚀 Запуск на Node.js', process.version);
  console.log('📊 Окружение:', process.env.NODE_ENV || 'development');
  
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║      TELEGRAM BOT + NEON POSTGRESQL SETUP           ║
  ╚══════════════════════════════════════════════════════╝
  `);

  // 1. Проверяем TELEGRAM_BOT_TOKEN
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('\n❌ ОШИБКА: TELEGRAM_BOT_TOKEN не найден');
    console.log('\n💡 Как получить:');
    console.log('   1. Откройте Telegram, найдите @BotFather');
    console.log('   2. Отправьте /newbot и следуйте инструкциям');
    console.log('   3. Скопируйте токен (например: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ)');
    console.log('   4. Добавьте в Vercel: TELEGRAM_BOT_TOKEN=ваш_токен');
    process.exit(1);
  }

  // 2. Проверяем VERCEL_URL
  if (!VERCEL_URL) {
    console.error('\n❌ ОШИБКА: VERCEL_URL не найден');
    console.log('\n💡 Решение:');
    console.log('   1. Убедитесь что проект задеплоен на Vercel');
    console.log('   2. Или для локальной разработки:');
    console.log('      npx ngrok http 3000');
    console.log('      export VERCEL_URL="ваш-ngrok-url"');
    process.exit(1);
  }

  // 3. Проверяем подключение к Neon
  console.log('\n🔍 ПРОВЕРКА ПЕРЕМЕННЫХ NEON:');
  
  const neonVars = {
    'DATABASE_URL': DATABASE_URL,
    'PGHOST_UNPOOLED': PGHOST_UNPOOLED,
    'PGUSER': PGUSER,
    'PGDATABASE': PGDATABASE,
    'POSTGRES_HOST': process.env.POSTGRES_HOST,
    'NEON_PROJECT_ID': process.env.NEON_PROJECT_ID
  };

  let neonConfigured = false;
  Object.entries(neonVars).forEach(([key, value]) => {
    if (value) {
      console.log(`   ✅ ${key}: установлен`);
      if (key === 'DATABASE_URL') {
        // Маскируем пароль в URL для безопасности
        const maskedUrl = value.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
        console.log(`      ${maskedUrl}`);
        neonConfigured = true;
      }
    } else {
      console.log(`   ⚠️  ${key}: не установлен`);
    }
  });

  if (!neonConfigured) {
    console.log('\n⚠️  ВНИМАНИЕ: Neon не полностью настроен');
    console.log('   Бот будет работать, но без базы данных');
  }

  // Формируем URL вебхука
  const webhookUrl = `${VERCEL_URL.startsWith('http') ? VERCEL_URL : `https://${VERCEL_URL}`}/api/bot`;
  
  // Маскируем токен
  const maskedToken = `${TELEGRAM_BOT_TOKEN.substring(0, 10)}...${TELEGRAM_BOT_TOKEN.substring(TELEGRAM_BOT_TOKEN.length - 5)}`;

  console.log('\n📋 ФИНАЛЬНАЯ КОНФИГУРАЦИЯ:');
  console.log(`   🤖 Telegram Bot: ${maskedToken}`);
  console.log(`   🌐 Vercel URL: ${VERCEL_URL}`);
  console.log(`   🔗 Webhook: ${webhookUrl}`);
  console.log(`   🗄️  Neon DB: ${neonConfigured ? '✅ подключен' : '❌ не настроен'}`);

  try {
    // ШАГ 1: Проверяем бота
    console.log('\n1️⃣  Проверяю Telegram бота...');
    const botResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
    );
    
    if (botResponse.ok) {
      const botData = await botResponse.json();
      console.log(`   ✅ Бот: @${botData.result.username}`);
      console.log(`   📛 Имя: ${botData.result.first_name}`);
      console.log(`   🆔 ID: ${botData.result.id}`);
    } else {
      console.error('   ❌ Неверный TELEGRAM_BOT_TOKEN');
      const error = await botResponse.text();
      console.log(`   ${error}`);
      process.exit(1);
    }

    // ШАГ 2: Проверяем соединение с Neon (если есть DATABASE_URL)
    if (DATABASE_URL) {
      console.log('\n2️⃣  Проверяю подключение к Neon PostgreSQL...');
      try {
        // Простая проверка через psql команду (если установлен)
        const { exec } = require('child_process');
        const testQuery = `echo "SELECT 1;" | psql "${DATABASE_URL}" -c "SELECT version();" 2>&1 | head -5`;
        
        exec(testQuery, (error, stdout, stderr) => {
          if (!error && stdout.includes('PostgreSQL')) {
            console.log('   ✅ Neon: подключение успешно');
            const lines = stdout.split('\n');
            console.log(`   📊 ${lines.find(l => l.includes('PostgreSQL'))}`);
          } else {
            console.log('   ⚠️  Neon: проверка через psql не удалась');
            console.log('   💡 Установите psql или проверьте подключение вручную');
          }
        });
      } catch (error) {
        console.log(`   ⚠️  Neon: ${error.message}`);
      }
    }

    // ШАГ 3: Устанавливаем вебхук
    console.log('\n3️⃣  Устанавливаю вебхук...');
    
    const webhookPayload = {
      url: webhookUrl,
      max_connections: 100,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
      secret_token: process.env.WEBHOOK_SECRET || undefined
    };

    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      }
    );

    const webhookData = await webhookResponse.json();

    if (webhookData.ok) {
      console.log('\n🎉 ВЕБХУК УСПЕШНО УСТАНОВЛЕН!');
      console.log(`\n📋 СВОДКА:`);
      console.log(`   Telegram Bot → ${webhookUrl}`);
      console.log(`   База данных → ${DATABASE_URL ? 'Neon PostgreSQL' : 'не используется'}`);
      console.log(`   Хостинг → Vercel (${VERCEL_URL})`);
      
      // Получаем детали
      await setTimeout(1000);
      const infoResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
      );
      const info = await infoResponse.json();
      
      console.log(`\n🔍 СТАТУС: ${info.result.pending_update_count || 0} ожидающих обновлений`);
      
      // Инструкция по тестированию
      console.log('\n🧪 ТЕСТИРОВАНИЕ:');
      console.log('   1. Откройте Telegram и найдите вашего бота');
      console.log('   2. Отправьте команду /start');
      console.log('   3. Проверьте логи в Vercel Dashboard');
      
      if (DATABASE_URL) {
        console.log('\n🗄️  NEON ИНТЕГРАЦИЯ:');
        console.log('   Для работы с базой добавьте в код:');
        console.log('   ```javascript');
        console.log('   import { neon } from "@neondatabase/serverless";');
        console.log('   const sql = neon(process.env.DATABASE_URL);');
        console.log('   const result = await sql`SELECT NOW()`;');
        console.log('   ```');
      }
      
    } else {
      console.error('\n❌ ОШИБКА УСТАНОВКИ ВЕБХУКА:');
      console.error(`   ${webhookData.description}`);
      
      if (webhookData.description.includes('url')) {
        console.log('\n💡 Возможные проблемы:');
        console.log('   - Vercel URL должен быть публично доступен');
        console.log('   - Домен должен использовать HTTPS');
        console.log('   - Проверьте что проект задеплоен: vercel --prod');
      }
    }

  } catch (error) {
    console.error('\n💥 ОШИБКА:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n🌐 Сетевая проблема:');
      console.log('   - Проверьте интернет соединение');
      console.log('   - api.telegram.org может быть недоступен');
    }
  }
}

// Утилиты для управления вебхуком
module.exports = { setupWebhook };

module.exports.testNeonConnection = async function() {
  console.log('🔗 Тестирую подключение к Neon...');
  
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL не найден');
    return;
  }
  
  try {
    // Для тестирования можно использовать простой HTTP запрос
    // или попробовать подключиться через библиотеку
    console.log('📊 Переменные Neon:');
    console.log(`   • Host: ${process.env.PGHOST_UNPOOLED}`);
    console.log(`   • Database: ${process.env.PGDATABASE}`);
    console.log(`   • User: ${process.env.PGUSER}`);
    console.log(`   • Project ID: ${process.env.NEON_PROJECT_ID}`);
    
    console.log('\n💡 Для полного теста создайте файл test-neon.js:');
    console.log(`
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function test() {
  try {
    const result = await sql\`SELECT NOW() as time, version() as version\`;
    console.log('✅ Подключение успешно:');
    console.log(result[0]);
  } catch (error) {
    console.error('❌ Ошибка подключения:', error.message);
  }
}
test();
    `);
    
  } catch (error) {
    console.error('Ошибка теста:', error.message);
  }
};

module.exports.deleteWebhook = async function() {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN не найден');
  }
  
  console.log('🗑️  Удаляю вебхук...');
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
    { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true })
    }
  );
  
  const result = await response.json();
  if (result.ok) {
    console.log('✅ Вебхук удален');
  } else {
    console.log('❌ Ошибка:', result.description);
  }
  return result;
};

// Автоматический запуск
if (require.main === module) {
  setupWebhook().catch(console.error);
}
