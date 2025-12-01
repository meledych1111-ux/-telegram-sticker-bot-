#!/usr/bin/env node

// Скрипт для настройки вебхука Telegram бота
const TelegramBot = require('node-telegram-bot-api');

console.log('🔧 Настройка вебхука для Telegram Sticker Bot\n');

// Получаем переменные окружения
const token = process.env.TELEGRAM_BOT_TOKEN;
const vercelUrl = process.env.VERCEL_URL;

// Проверяем наличие обязательных переменных
if (!token) {
  console.error('❌ ОШИБКА: TELEGRAM_BOT_TOKEN не найден в переменных окружения!');
  console.log('\nℹ️ Как исправить:');
  console.log('1. Добавьте TELEGRAM_BOT_TOKEN в Vercel → Settings → Environment Variables');
  console.log('2. Получите токен у @BotFather в Telegram');
  console.log('3. Перезапустите деплоймент');
  process.exit(1);
}

if (!vercelUrl) {
  console.error('❌ ОШИБКА: VERCEL_URL не установлен!');
  console.log('\nℹ️ VERCEL_URL автоматически устанавливается Vercel.');
  console.log('Проверьте что проект задеплоен и доступен по URL');
  process.exit(1);
}

const webhookUrl = `${vercelUrl}/api/bot`;
const bot = new TelegramBot(token);

async function setupWebhook() {
  try {
    console.log('📝 Информация о настройке:');
    console.log(`   Бот токен: ${token.substring(0, 10)}...${token.substring(token.length - 5)}`);
    console.log(`   Vercel URL: ${vercelUrl}`);
    console.log(`   Webhook URL: ${webhookUrl}`);
    console.log('');
    
    // Получаем информацию о боте
    console.log('🤖 Проверяю информацию о боте...');
    const botInfo = await bot.getMe();
    console.log(`   ✅ Бот найден: @${botInfo.username} (${botInfo.first_name})`);
    
    // Получаем текущую информацию о вебхуке
    console.log('\n📡 Проверяю текущий вебхук...');
    const currentWebhook = await bot.getWebHookInfo();
    
    if (currentWebhook.url) {
      console.log(`   Текущий вебхук: ${currentWebhook.url}`);
      console.log(`   Ожидает обновлений: ${currentWebhook.pending_update_count}`);
      
      if (currentWebhook.url === webhookUrl) {
        console.log('   ✅ Вебхук уже настроен правильно!');
        return showSuccess(botInfo);
      }
      
      console.log('\n🗑️ Удаляю старый вебхук...');
      await bot.deleteWebHook();
      console.log('   ✅ Старый вебхук удален');
    } else {
      console.log('   ℹ️ Вебхук не установлен');
    }
    
    // Устанавливаем новый вебхук
    console.log('\n🔄 Устанавливаю новый вебхук...');
    await bot.setWebHook(webhookUrl, {
      max_connections: 40,
      allowed_updates: ['message', 'callback_query']
    });
    console.log(`   ✅ Вебхук установлен: ${webhookUrl}`);
    
    // Проверяем установку
    console.log('\n🔍 Проверяю установку...');
    const newWebhook = await bot.getWebHookInfo();
    
    if (newWebhook.url === webhookUrl) {
      console.log('   ✅ Вебхук успешно установлен!');
      console.log(`   URL: ${newWebhook.url}`);
      console.log(`   Ожидает: ${newWebhook.pending_update_count} обновлений`);
      console.log(`   Ошибка: ${newWebhook.last_error_message || 'Нет'}`);
      
      showSuccess(botInfo);
    } else {
      console.error('   ❌ Не удалось установить вебхук');
      console.log('   Полученный URL:', newWebhook.url);
    }
    
  } catch (error) {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    console.log('\n🔧 Возможные причины и решения:');
    console.log('1. Неверный токен бота - проверьте в @BotFather');
    console.log('2. Бот заблокирован - проверьте статус бота');
    console.log('3. Проблемы с сетью - проверьте интернет соединение');
    console.log('4. URL недоступен - убедитесь что Vercel проект
