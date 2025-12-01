#!/usr/bin/env node

/**
 * Скрипт для настройки вебхука Telegram бота
 * Версия для Node.js 24.x
 */

const TelegramBot = require('node-telegram-bot-api');
const readline = require('readline');

// Создаем интерфейс для ввода
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Функция для запроса ввода
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function setupWebhook() {
  console.log('🔧 Настройка вебхука для Telegram Sticker Bot\n');
  console.log('=' .repeat(50));
  
  try {
    // 1. Запрос токена бота
    let token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.log('📝 Введите токен бота (получите у @BotFather):');
      token = await askQuestion('Токен: ');
      
      if (!token) {
        console.error('❌ Токен обязателен для настройки вебхука');
        process.exit(1);
      }
    }
    
    // 2. Запрос URL вебхука
    let webhookUrl = process.env.VERCEL_URL;
    
    if (!webhookUrl) {
      console.log('\n🌐 Введите URL вашего приложения на Vercel:');
      console.log('Пример: https://your-project.vercel.app');
      webhookUrl = await askQuestion('URL: ');
      
      if (!webhookUrl) {
        console.error('❌ URL обязателен для настройки вебхука');
        process.exit(1);
      }
    }
    
    // Формируем полный URL вебхука
    const fullWebhookUrl = `${webhookUrl}/api/bot`;
    
    console.log('\n📊 Параметры настройки:');
    console.log(`   Токен: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);
    console.log(`   Вебхук URL: ${fullWebhookUrl}`);
    
    // 3. Создаем экземпляр бота
    const bot = new TelegramBot(token);
    
    // 4. Получаем информацию о боте
    console.log('\n🤖 Проверяю информацию о боте...');
    const botInfo = await bot.getMe();
    console.log(`   ✅ Бот: @${botInfo.username} (${botInfo.first_name})`);
    
    // 5. Проверяем текущий вебхук
    console.log('\n📡 Проверяю текущий вебхук...');
    const webhookInfo = await bot.getWebHookInfo();
    
    if (webhookInfo.url) {
      console.log(`   Текущий вебхук: ${webhookInfo.url}`);
      console.log(`   Ожидает обновлений: ${webhookInfo.pending_update_count}`);
      
      if (webhookInfo.url === fullWebhookUrl) {
        console.log('   ✅ Вебхук уже настроен правильно!');
        showSuccess(botInfo, fullWebhookUrl);
        rl.close();
        return;
      }
      
      // 6. Удаляем старый вебхук
      console.log('\n🗑️ Удаляю старый вебхук...');
      await bot.deleteWebHook();
      console.log('   ✅ Старый вебхук удален');
    } else {
      console.log('   ℹ️ Вебхук не установлен');
    }
    
    // 7. Устанавливаем новый вебхук
    console.log('\n🔄 Устанавливаю новый вебхук...');
    await bot.setWebHook(fullWebhookUrl, {
      max_connections: 40,
      allowed_updates: ['message', 'callback_query', 'inline_query']
    });
    console.log(`   ✅ Вебхук установлен: ${fullWebhookUrl}`);
    
    // 8. Проверяем установку
    console.log('\n🔍 Проверяю установку...');
    const newWebhookInfo = await bot.getWebHookInfo();
    
    if (newWebhookInfo.url === fullWebhookUrl) {
      console.log('   ✅ Вебхук успешно установлен!');
      console.log(`   URL: ${newWebhookInfo.url}`);
      console.log(`   Ожидает: ${newWebhookInfo.pending_update_count} обновлений`);
      console.log(`   Последняя ошибка: ${newWebhookInfo.last_error_message || 'Нет'}`);
      
      showSuccess(botInfo, fullWebhookUrl);
    } else {
      console.error('   ❌ Не удалось установить вебхук');
      console.log(`   Полученный URL: ${newWebhookInfo.url}`);
      console.log(`   Ожидаемый URL: ${fullWebhookUrl}`);
    }
    
  } catch (error) {
    console.error('\n❌ Ошибка при настройке вебхука:', error.message);
    console.log('\n🔧 Возможные причины:');
    console.log('1. Неверный токен бота');
    console.log('2. Бот заблокирован или не активирован');
    console.log('3. Проблемы с интернет соединением');
    console.log('4. URL вебхука недоступен для Telegram');
    
    if (error.response) {
      console.log('\n📡 Ответ от Telegram API:');
      console.log(JSON.stringify(error.response.body, null, 2));
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

function showSuccess(botInfo, webhookUrl) {
  console.log('\n🎉 НАСТРОЙКА ЗАВЕРШЕНА УСПЕШНО!');
  console.log('=' .repeat(50));
  console.log('\n📱 Ссылка на бота:');
  console.log(`   https://t.me/${botInfo.username}`);
  
  console.log('\n🌐 Вебхук URL:');
  console.log(`   ${webhookUrl}`);
  
  console.log('\n🔧 Полезные ссылки:');
  console.log(`   • Проверка вебхука: https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || 'TOKEN'}/getWebhookInfo`);
  console.log(`   • Удаление вебхука: https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || 'TOKEN'}/deleteWebhook`);
  
  console.log('\n💡 Тестирование:');
  console.log('   1. Откройте бота в Telegram');
  console.log('   2. Напишите /start');
  console.log('   3. Проверьте работу меню и создание стикеров');
  
  console.log('\n' + '=' .repeat(50));
  console.log('\n✅ Бот готов к работе! Настройка завершена.\n');
}

// Запускаем настройку
if (require.main === module) {
  setupWebhook();
}

module.exports = { setupWebhook };
