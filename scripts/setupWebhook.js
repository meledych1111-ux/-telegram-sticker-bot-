// 🔗 НАСТРОЙКА ВЕБХУКА ДЛЯ TELEGRAM BOT API
const axios = require('axios');

async function setupWebhook() {
  // Получаем переменные из окружения Vercel
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const VERCEL_URL = process.env.VERCEL_URL;

  // Проверяем что переменные установлены в Vercel
  if (!BOT_TOKEN) {
    console.error('❌ ОШИБКА: BOT_TOKEN не установлен в Vercel Environment Variables');
    console.log('💡 Решение: Добавьте BOT_TOKEN в Vercel Dashboard → Settings → Environment Variables');
    console.log('   Пример: 1234567890:ABCdefGHIjklMnOpQRstUvWxYz123456789');
    process.exit(1);
  }

  if (!VERCEL_URL) {
    console.error('❌ ОШИБКА: VERCEL_URL не установлен в Vercel Environment Variables');
    console.log('💡 Решение: Добавьте VERCEL_URL в Vercel Dashboard → Settings → Environment Variables');
    console.log('   Пример: https://your-app.vercel.app');
    process.exit(1);
  }

  // URL для вебхука Telegram Bot API
  const webhookUrl = `${VERCEL_URL}/api/bot`;

  console.log('🔄 Настраиваю вебхук для Telegram Bot API...');
  console.log(`🤖 Бот: с токеном ${BOT_TOKEN.substring(0, 10)}...`);
  console.log(`🌐 Vercel URL: ${VERCEL_URL}`);
  console.log(`🔗 Webhook URL: ${webhookUrl}`);

  try {
    // Сначала проверяем текущий вебхук
    console.log('📡 Проверяю текущие настройки вебхука...');
    const currentWebhook = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    
    if (currentWebhook.data.result.url) {
      console.log(`📝 Текущий вебхук: ${currentWebhook.data.result.url}`);
      
      // Если вебхук уже настроен на нужный URL
      if (currentWebhook.data.result.url === webhookUrl) {
        console.log('✅ Вебхук уже настроен правильно!');
        await showBotInfo(BOT_TOKEN);
        return;
      }
    }

    // Устанавливаем вебхук через Telegram Bot API
    console.log('⚙️ Устанавливаю новый вебхук...');
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        url: webhookUrl,
        max_connections: 40,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: true // Очищаем pending updates
      }
    );

    // Проверяем результат от Telegram API
    if (response.data.ok) {
      console.log('✅ ВЕБХУК УСПЕШНО НАСТРОЕН ДЛЯ TELEGRAM BOT API!');
      console.log(`📝 Telegram Bot API теперь отправляет запросы на: ${webhookUrl}`);
      
      // Дополнительная проверка вебхука
      const infoResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const webhookInfo = infoResponse.data.result;
      
      console.log('📊 Информация о вебхуке:');
      console.log(`   ✅ URL: ${webhookInfo.url}`);
      console.log(`   ✅ Ожидающие обновления: ${webhookInfo.pending_update_count}`);
      console.log(`   ✅ Ошибок: ${webhookInfo.last_error_message || 'нет'}`);
      console.log(`   ✅ Дата последней ошибки: ${webhookInfo.last_error_date || 'никогда'}`);
      
      // Показываем информацию о боте
      await showBotInfo(BOT_TOKEN);
      
    } else {
      console.error('❌ Ошибка настройки вебхука в Telegram API:', response.data.description);
    }

  } catch (error) {
    console.error('❌ Ошибка настройки вебхука:');
    
    if (error.response) {
      console.error(`   📡 Status: ${error.response.status}`);
      console.error(`   📝 Response: ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      console.error('   🔌 Нет ответа от Telegram API');
    } else {
      console.error(`   💥 ${error.message}`);
    }
    
    console.log('\n💡 Проверьте в Vercel:');
    console.log('   1. Правильность BOT_TOKEN в Environment Variables');
    console.log('   2. Правильность VERCEL_URL в Environment Variables');
    console.log('   3. Что бот активирован в BotFather');
    console.log('   4. Что сделан redeploy после добавления переменных');
  }
}

// 📊 ПОКАЗАТЬ ИНФОРМАЦИЮ О БОТЕ
async function showBotInfo(BOT_TOKEN) {
  try {
    console.log('\n🤖 Получаю информацию о боте...');
    const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    
    if (botInfo.data.ok) {
      const bot = botInfo.data.result;
      console.log('✅ Информация о боте:');
      console.log(`   👤 Имя: ${bot.first_name}`);
      console.log(`   📝 Username: @${bot.username}`);
      console.log(`   🆔 ID: ${bot.id}`);
      console.log(`   🔗 Ссылка: https://t.me/${bot.username}`);
    }
  } catch (error) {
    console.log('❌ Не удалось получить информацию о боте');
  }
}

// 🗑️ ФУНКЦИЯ УДАЛЕНИЯ ВЕБХУКА
async function deleteWebhook() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN не установлен');
    return;
  }

  try {
    console.log('🗑️ Удаляю вебхук...');
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    
    if (response.data.ok) {
      console.log('✅ Вебхук удален! Бот перейдет в режим long polling');
    } else {
      console.error('❌ Ошибка удаления вебхука:', response.data.description);
    }
  } catch (error) {
    console.error('❌ Ошибка удаления вебхука:', error.response?.data || error.message);
  }
}

// 📋 ФУНКЦИЯ ПРОВЕРКИ СТАТУСА
async function checkWebhookStatus() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  
  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN не установлен');
    return;
  }

  try {
    console.log('📡 Проверяю статус вебхука...');
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookInfo = response.data.result;
    
    console.log('📊 Статус вебхука:');
    console.log(`   🔗 URL: ${webhookInfo.url || 'не установлен'}`);
    console.log(`   📊 Ожидающие обновления: ${webhookInfo.pending_update_count}`);
    console.log(`   ❌ Последняя ошибка: ${webhookInfo.last_error_message || 'нет'}`);
    console.log(`   📅 Дата ошибки: ${webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toLocaleString() : 'никогда'}`);
    
  } catch (error) {
    console.error('❌ Ошибка проверки статуса:', error.response?.data || error.message);
  }
}

// Автоматически запускаем если файл вызван напрямую
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'delete':
      deleteWebhook();
      break;
    case 'status':
      checkWebhookStatus();
      break;
    case 'setup':
    default:
      setupWebhook();
      break;
  }
}

// Экспортируем функции для использования в других файлах
module.exports = {
  setupWebhook,
  deleteWebhook,
  checkWebhookStatus
};
