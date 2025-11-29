// ⚡ ГЛАВНЫЙ ФАЙЛ С АВТО-ИНИЦИАЛИЗАЦИЕЙ
const { processMessage } = require('../lib/telegramAPI');
const { initializeDatabase } = require('../lib/database');

// 🚀 АВТОМАТИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ ПРИ ЗАПУСКЕ
let isInitialized = false;

async function initializeBot() {
  if (isInitialized) return;
  
  console.log('🤖 Инициализация Telegram бота...');
  
  try {
    // Инициализируем базу данных
    await initializeDatabase();
    
    console.log('✅ Бот инициализирован и готов к работе!');
    isInitialized = true;
    
  } catch (error) {
    console.error('❌ Ошибка инициализации бота:', error);
    // Продолжаем работу даже при ошибке инициализации
    isInitialized = true;
  }
}

// Запускаем инициализацию сразу
initializeBot();

module.exports = async (req, res) => {
  // Разрешаем все типы запросов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обрабатываем предварительные запросы
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET запрос - информация о боте
  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Бот работает!',
      message: 'Найдите бота в Telegram и отправьте изображение',
      bot_username: '@MyStickerMakertBot',
      database_initialized: isInitialized,
      timestamp: new Date().toISOString()
    });
  }

  // POST запрос - сообщение от Telegram
  if (req.method === 'POST') {
    try {
      console.log('📨 Получено сообщение от Telegram');
      
      // Ждем инициализацию если еще не завершена
      if (!isInitialized) {
        console.log('⏳ Ожидаю инициализацию...');
        await initializeBot();
      }
      
      await processMessage(req.body);
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('❌ Ошибка в api/bot.js:', error);
      return res.status(200).json({ status: 'error', error: error.message });
    }
  }

  // Любые другие запросы
  res.status(404).json({ error: 'Не найдено' });
};
