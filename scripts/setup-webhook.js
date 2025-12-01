#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

async function setupWebhook() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const WEBHOOK_URL = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/api/bot`
    : process.env.WEBHOOK_URL;
  
  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required in .env file');
    process.exit(1);
  }
  
  if (!WEBHOOK_URL) {
    console.error('❌ WEBHOOK_URL is required in .env file');
    process.exit(1);
  }
  
  console.log('🔧 Настройка вебхука для Telegram бота...');
  console.log(`🤖 Бот: ${BOT_TOKEN.substring(0, 10)}...`);
  console.log(`🌐 Вебхук: ${WEBHOOK_URL}`);
  
  try {
    // Устанавливаем вебхук
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      params: {
        url: WEBHOOK_URL,
        max_connections: 40,
        allowed_updates: JSON.stringify([
          'message',
          'callback_query',
          'inline_query',
          'chosen_inline_result'
        ])
      }
    });
    
    if (response.data.ok) {
      console.log('✅ Вебхук успешно установлен!');
      console.log(`📊 Результат: ${response.data.description}`);
      
      // Получаем информацию о боте
      const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      console.log(`🤖 Бот: @${botInfo.data.result.username}`);
      console.log(`👤 Имя: ${botInfo.data.result.first_name}`);
      
      // Получаем информацию о вебхуке
      const webhookInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      console.log('📡 Информация о вебхуке:');
      console.log(`   URL: ${webhookInfo.data.result.url || 'Не установлен'}`);
      console.log(`   Ожидает: ${webhookInfo.data.result.pending_update_count || 0} обновлений`);
      console.log(`   Ошибок: ${webhookInfo.data.result.last_error_date ? 'Да' : 'Нет'}`);
      
      if (webhookInfo.data.result.last_error_message) {
        console.log(`   Последняя ошибка: ${webhookInfo.data.result.last_error_message}`);
      }
      
    } else {
      console.error('❌ Ошибка при установке вебхука:', response.data.description);
    }
    
  } catch (error) {
    console.error('❌ Ошибка сети:', error.message);
    if (error.response) {
      console.error('   Ответ Telegram:', error.response.data);
    }
  }
}

// Запуск скрипта
setupWebhook();
