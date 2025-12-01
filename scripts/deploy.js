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
    console.log('
