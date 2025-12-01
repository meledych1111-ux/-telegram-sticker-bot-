// Дополнительные команды и обработчики

module.exports = {
  // Обработка callback-запросов
  handleCallback: async (bot, chatId, userId, data) => {
    switch (data) {
      case 'back_to_menu':
        await bot.sendMessage(chatId, 'Возвращаюсь в меню...');
        return showMainMenu(bot, chatId);
      case 'effect_cancel':
        await bot.sendMessage(chatId, '❌ Создание стикера отменено');
        return showMainMenu(bot, chatId);
      default:
        return null;
    }
  },

  // Показать информацию о боте
  showBotInfo: async (bot, chatId) => {
    const info = await bot.getMe();
    const message = `🤖 *Информация о боте:*\n\n` +
      `Имя: ${info.first_name}\n` +
      `Username: @${info.username}\n` +
      `ID: ${info.id}\n\n` +
      `Создан для обработки изображений и создания стикеров!`;
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  },

  // Создать папку через inline-клавиатуру
  createFolderWithKeyboard: async (bot, chatId, userId, folderName) => {
    const { createFolder } = require('../lib/database');
    
    try {
      const folder = await createFolder(userId, folderName);
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '📁 Открыть папку', callback_data: `open_folder_${folder.id}` }],
          [{ text: '➕ Добавить стикер', callback_data: `add_to_folder_${folder.id}` }]
        ]
      };
      
      await bot.sendMessage(chatId, `✅ Папка "${folderName}" создана!`, {
        reply_markup: keyboard
      });
      
      return folder;
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Не удалось создать папку');
      throw error;
    }
  },

  // Показать топ пользователей
  showTopUsers: async (bot, chatId) => {
    const { sql } = require('../lib/database');
    
    try {
      const topUsers = await sql`
        SELECT username, stickers_count, rating
        FROM users
        ORDER BY stickers_count DESC
        LIMIT 10
      `;
      
      if (topUsers.length === 0) {
        await bot.sendMessage(chatId, '📊 Пока нет статистики пользователей');
        return;
      }
      
      let message = '🏆 *Топ пользователей:*\n\n';
      topUsers.forEach((user, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📌';
        message += `${medal} ${user.username || 'Аноним'}\n` +
                  `   Стикеров: ${user.stickers_count}\n` +
                  `   Рейтинг: ${user.rating}/10\n\n`;
      });
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Ошибка при получении топа:', error);
      await bot.sendMessage(chatId, '❌ Не удалось загрузить топ пользователей');
    }
  },

  // Экспорт стикеров (ссылка для скачивания)
  exportStickers: async (bot, chatId, userId) => {
    const { getUserStickers } = require('../lib/database');
    
    try {
      const stickers = await getUserStickers(userId);
      
      if (stickers.length === 0) {
        await bot.sendMessage(chatId, '📭 У вас нет стикеров для экспорта');
        return;
      }
      
      const message = `📦 *Экспорт стикеров:*\n\n` +
        `Всего стикеров: ${stickers.length}\n` +
        `Вы можете скачать каждый стикер отдельно.\n\n` +
        `Для массового экспорта свяжитесь с администратором.`;
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
      // Отправляем первый стикер как пример
      if (stickers[0]) {
        await bot.sendPhoto(chatId, stickers[0].image_data, {
          caption: 'Пример вашего стикера'
        });
      }
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      await bot.sendMessage(chatId, '❌ Ошибка при экспорте стикеров');
    }
  },

  // Настройки пользователя
  showUserSettings: async (bot, chatId, userId) => {
    const { getStats } = require('../lib/database');
    
    try {
      const stats = await getStats(userId);
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '🔄 Сбросить статистику', callback_data: 'reset_stats' },
            { text: '🗑️ Удалить все', callback_data: 'delete_all' }
          ],
          [
            { text: '📊 Подробная статистика', callback_data: 'detailed_stats' }
          ],
          [
            { text: '🔙 Назад', callback_data: 'back_to_menu' }
          ]
        ]
      };
      
      const message = `⚙️ *Ваши настройки:*\n\n` +
        `👤 Имя: ${stats.username}\n` +
        `🎨 Стикеров: ${stats.stickers_count}\n` +
        `📂 Папок: ${stats.folders_count}\n` +
        `⭐ Рейтинг: ${stats.rating}/10`;
      
      await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Ошибка настроек:', error);
      await bot.sendMessage(chatId, '❌ Не удалось загрузить настройки');
    }
  },

  // Обработка аудио сообщений (конвертация в текст)
  handleVoiceMessage: async (bot, chatId, userId, fileId) => {
    await bot.sendMessage(chatId, '🎤 Голосовые сообщения пока не поддерживаются.\nОтправьте текст или изображение.');
  },

  // Системная информация
  showSystemInfo: async (bot, chatId) => {
    const os = require('os');
    
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      node: process.version,
      uptime: Math.floor(process.uptime() / 60) + ' мин.',
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    };
    
    const message = `🖥️ *Системная информация:*\n\n` +
      `Платформа: ${info.platform}\n` +
      `Архитектура: ${info.arch}\n` +
      `Node.js: ${info.node}\n` +
      `Время работы: ${info.uptime}\n` +
      `Память: ${info.memory}`;
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
};

// Вспомогательная функция для главного меню
async function showMainMenu(bot, chatId) {
  const keyboard = {
    reply_markup: {
      keyboard: [
        ['🎨 Новый стикер', '📁 Мои стикеры'],
        ['📂 Папки', '📊 Статистика'],
        ['ℹ️ Помощь', '📋 Меню']
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
  
  await bot.sendMessage(chatId, '📱 *Главное меню:*\nВыберите действие:', {
    parse_mode: 'Markdown',
    ...keyboard
  });
}
