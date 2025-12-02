// 🔗 НАСТРОЙКА ВЕБХУКА ДЛЯ TELEGRAM BOT API (Node.js 20+)
async function setupWebhook() {
  // Получаем переменные из окружения Vercel
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const VERCEL_URL = process.env.VERCEL_URL;

  // Проверяем что переменные установлены в Vercel
  if (!BOT_TOKEN) {
    console.error('❌ ОШИБКА: BOT_TOKEN не установлен в Vercel Environment Variables');
    console.log('💡 Решение: Добавьте BOT_TOKEN в Vercel Dashboard → Settings → Environment Variables');
    process.exit(1);
  }

  if (!VERCEL_URL) {
    console.error('❌ ОШИБКА: VERCEL_URL не установлен в Vercel Environment Variables');
    console.log('💡 Решение: Добавьте VERCEL_URL в Vercel Dashboard → Settings → Environment Variables');
    process.exit(1);
  }

  // URL для вебхука Telegram Bot API
  const webhookUrl = `${VERCEL_URL}/api/bot`;

  console.log('🔄 Настраиваю вебхук для Telegram Bot API...');
  console.log(`🤖 Бот: @MyStickerMakertBot`);
  console.log(`🌐 Vercel URL: ${VERCEL_URL}`);
  console.log(`🔗 Webhook URL: ${webhookUrl}`);

  try {
    // Устанавливаем вебхук через Telegram Bot API (используем встроенный fetch)
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          max_connections: 40,
          allowed_updates: ['message', 'callback_query']
        })
      }
    );

    const data = await response.json();

    // Проверяем результат от Telegram API
    if (data.ok) {
      console.log('✅ ВЕБХУК УСПЕШНО НАСТРОЕН ДЛЯ TELEGRAM BOT API!');
      console.log(`📝 Telegram Bot API теперь отправляет запросы на: ${webhookUrl}`);
      
      // Дополнительная проверка вебхука
      const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const info = await infoResponse.json();
      console.log('📊 Информация о вебхуке:', JSON.stringify(info.result, null, 2));
      
    } else {
      console.error('❌ Ошибка настройки вебхука в Telegram API:', data.description);
    }

  } catch (error) {
    console.error('❌ Ошибка настройки вебхука:', error.message);
    console.log('💡 Проверьте в Vercel:');
    console.log('   - Правильность BOT_TOKEN в Environment Variables');
    console.log('   - Правильность VERCEL_URL в Environment Variables');
    console.log('   - Что сделан redeploy после добавления переменных');
  }
}

// Автоматически запускаем если файл вызван напрямую
if (require.main === module) {
  setupWebhook();
}

// Экспортируем функцию для использования в других файлах
module.exports = setupWebhook;
