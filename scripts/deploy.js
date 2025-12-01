#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 Запуск деплоя Telegram Sticker Bot...\n');

// Проверка переменных окружения
function checkEnvVariables() {
  console.log('🔍 Проверка переменных окружения...');
  
  const required = ['BOT_TOKEN', 'DATABASE_URL'];
  const missing = [];
  
  required.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0) {
    console.error(`❌ Отсутствуют переменные: ${missing.join(', ')}`);
    console.log('💡 Создайте файл .env на основе .env.example');
    process.exit(1);
  }
  
  console.log('✅ Все переменные окружения настроены\n');
}

// Проверка зависимостей
function checkDependencies() {
  console.log('📦 Проверка зависимостей...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`   Имя: ${packageJson.name}`);
    console.log(`   Версия: ${packageJson.version}`);
    console.log(`   Node: ${packageJson.engines?.node || 'не указана'}`);
    console.log('✅ Зависимости проверены\n');
  } catch (error) {
    console.error('❌ Ошибка чтения package.json:', error.message);
    process.exit(1);
  }
}

// Установка зависимостей
function installDependencies() {
  console.log('📦 Установка зависимостей...');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Зависимости установлены\n');
  } catch (error) {
    console.error('❌ Ошибка установки зависимостей:', error.message);
    process.exit(1);
  }
}

// Проверка базы данных
async function checkDatabase() {
  console.log('🗄️ Проверка подключения к базе данных...');
  
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const result = await pool.query('SELECT version()');
    console.log(`✅ PostgreSQL: ${result.rows[0].version.split(',')[0]}`);
    
    await pool.end();
    console.log('✅ Подключение к базе данных успешно\n');
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    console.log('💡 Проверьте DATABASE_URL в .env файле');
    process.exit(1);
  }
}

// Деплой на Vercel
function deployToVercel() {
  console.log('☁️ Деплой на Vercel...\n');
  
  try {
    // Проверяем, установлен ли Vercel CLI
    execSync('vercel --version', { stdio: 'pipe' });
    
    console.log('🚀 Запуск деплоя...');
    execSync('vercel --prod', { stdio: 'inherit' });
    
    console.log('\n✅ Деплой завершен успешно!');
    
  } catch (error) {
    if (error.message.includes('Command failed: vercel --version')) {
      console.error('❌ Vercel CLI не установлен');
      console.log('💡 Установите: npm install -g vercel');
    } else {
      console.error('❌ Ошибка деплоя:', error.message);
    }
    process.exit(1);
  }
}

// Деплой на альтернативный хостинг
function deployAlternative() {
  console.log('🌐 Альтернативный метод деплоя...\n');
  
  console.log('📝 Инструкция для ручного деплоя:');
  console.log('1. Создайте репозиторий на GitHub');
  console.log('2. Загрузите код:');
  console.log('   git init');
  console.log('   git add .');
  console.log('   git commit -m "Initial commit"');
  console.log('   git branch -M main');
  console.log('   git remote add origin https://github.com/YOUR_USERNAME/telegram-sticker-bot.git');
  console.log('   git push -u origin main');
  console.log('\n3. Импортируйте проект в Vercel:');
  console.log('   • Зайдите на vercel.com');
  console.log('   • Нажмите "New Project"');
  console.log('   • Импортируйте из GitHub');
  console.log('   • Настройте переменные окружения');
  console.log('   • Нажмите "Deploy"');
  console.log('\n4. Настройте вебхук:');
  console.log('   https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook');
  console.log('   ?url=https://YOUR_VERCEL_URL.vercel.app/api/bot');
}

// Главная функция
async function main() {
  console.log('='.repeat(50));
  console.log('TELEGRAM STICKER BOT DEPLOYMENT');
  console.log('='.repeat(50) + '\n');
  
  try {
    // Проверки
    checkEnvVariables();
    checkDependencies();
    await checkDatabase();
    
    // Установка зависимостей
    installDependencies();
    
    // Выбор метода деплоя
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\nВыберите метод деплоя:\n1. Vercel CLI (рекомендуется)\n2. Ручной деплой через GitHub\nВаш выбор (1/2): ', (answer) => {
      rl.close();
      
      if (answer === '1') {
        deployToVercel();
      } else if (answer === '2') {
        deployAlternative();
      } else {
        console.log('❌ Неверный выбор');
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main();
}
