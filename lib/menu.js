// Кнопочные меню для Telegram бота
module.exports = {
  // ГЛАВНОЕ МЕНЮ (Reply Keyboard)
  showMainMenu: async (bot, chatId) => {
    const menu = {
      reply_markup: {
        keyboard: [
          [
            { text: '🎨 Создать стикер' },
            { text: '📁 Мои стикеры' }
          ],
          [
            { text: '📂 Папки' },
            { text: '⭐ Избранное' }
          ],
          [
            { text: '📊 Статистика' },
            { text: '⚙️ Настройки' }
          ],
          [
            { text: 'ℹ️ Помощь' },
            { text: '👥 Топ пользователей' }
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
        input_field_placeholder: 'Выберите действие или отправьте фото'
      }
    };

    await bot.sendMessage(chatId, '🎭 *Главное меню*\nВыберите действие:', {
      parse_mode: 'Markdown',
      ...menu
    });
  },

  // МЕНЮ ЭФФЕКТОВ (Inline Keyboard)
  showEffectsMenu: async (bot, chatId) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📝 Добавить текст', callback_data: 'effect_text' },
          { text: '🖼️ Красивая рамка', callback_data: 'effect_frame' }
        ],
        [
          { text: '✨ Перламутр', callback_data: 'effect_pearl' },
          { text: '🌈 Градиент', callback_data: 'effect_gradient' }
        ],
        [
          { text: '🔲 Без эффектов', callback_data: 'effect_none' },
          { text: '🚫 Отменить', callback_data: 'cancel' }
        ],
        [
          { text: '✅ Готово', callback_data: 'effect_finish' }
        ]
      ]
    };

    await bot.sendMessage(chatId, '🎨 *Выберите эффекты для стикера:*\n\n' +
      '📝 *Текст* - добавить надпись\n' +
      '🖼️ *Рамка* - красивая белая рамка\n' +
      '✨ *Перламутр* - градиентный эффект\n' +
      '🌈 *Градиент* - цветовой переход\n' +
      '🔲 *Без эффектов* - только обрезка', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ ПАПОК (Inline Keyboard)
  showFoldersMenu: async (bot, chatId, folders = []) => {
    let keyboard = {
      inline_keyboard: []
    };

    // Кнопки папок (если есть)
    if (folders.length > 0) {
      const folderButtons = [];
      folders.forEach((folder, index) => {
        if (index % 2 === 0) {
          folderButtons.push([]);
        }
        folderButtons[folderButtons.length - 1].push({
          text: `📂 ${folder.name}`,
          callback_data: `folder_${folder.id}`
        });
      });
      keyboard.inline_keyboard.push(...folderButtons);
    }

    // Кнопки действий
    keyboard.inline_keyboard.push(
      [
        { text: '➕ Создать папку', callback_data: 'create_folder' },
        { text: '🗑️ Удалить папку', callback_data: 'delete_folder' }
      ],
      [
        { text: '📥 Импорт', callback_data: 'import_stickers' },
        { text: '📤 Экспорт', callback_data: 'export_stickers' }
      ],
      [
        { text: '🔙 Назад', callback_data: 'back_to_menu' }
      ]
    );

    const message = folders.length === 0 
      ? '📂 *Управление папками*\nУ вас пока нет папок. Создайте первую!' 
      : `📂 *Управление папками*\nВаши папки (${folders.length}):`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ СТИКЕРОВ (для просмотра)
  showStickersMenu: async (bot, chatId, stickers = []) => {
    const keyboard = {
      inline_keyboard: []
    };

    if (stickers.length > 0) {
      // Показываем первые 6 стикеров
      const stickerButtons = [];
      for (let i = 0; i < Math.min(6, stickers.length); i++) {
        if (i % 3 === 0) {
          stickerButtons.push([]);
        }
        stickerButtons[stickerButtons.length - 1].push({
          text: `🎨 ${i + 1}`,
          callback_data: `sticker_${stickers[i].id}`
        });
      }
      keyboard.inline_keyboard.push(...stickerButtons);
    }

    // Кнопки навигации
    keyboard.inline_keyboard.push(
      [
        { text: '⬅️ Предыдущие', callback_data: 'prev_stickers' },
        { text: 'Следующие ➡️', callback_data: 'next_stickers' }
      ],
      [
        { text: '🗑️ Удалить все', callback_data: 'delete_all_stickers' },
        { text: '⭐ В избранное', callback_data: 'add_to_favorites' }
      ],
      [
        { text: '🔙 Назад', callback_data: 'back_to_menu' }
      ]
    );

    const message = stickers.length === 0
      ? '📭 *Мои стикеры*\nУ вас пока нет стикеров. Создайте первый!'
      : `🎨 *Мои стикеры*\nВсего: ${stickers.length} стикеров\nВыберите стикер для действий:`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ НАСТРОЕК
  showSettingsMenu: async (bot, chatId) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '👤 Изменить имя', callback_data: 'change_name' },
          { text: '🔔 Уведомления', callback_data: 'notifications' }
        ],
        [
          { text: '🎨 Качество', callback_data: 'quality_settings' },
          { text: '💾 Автосохранение', callback_data: 'autosave' }
        ],
        [
          { text: '🗑️ Очистить кеш', callback_data: 'clear_cache' },
          { text: '📱 Тема', callback_data: 'theme' }
        ],
        [
          { text: '🔙 Назад', callback_data: 'back_to_menu' },
          { text: '❓ Помощь', callback_data: 'settings_help' }
        ]
      ]
    };

    await bot.sendMessage(chatId, '⚙️ *Настройки бота*\n\n' +
      'Настройте бота под свои предпочтения:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ ПОМОЩИ
  showHelpMenu: async (bot, chatId) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📖 Как создать стикер', callback_data: 'help_create' },
          { text: '📁 Работа с папками', callback_data: 'help_folders' }
        ],
        [
          { text: '✨ Эффекты', callback_data: 'help_effects' },
          { text: '📊 Статистика', callback_data: 'help_stats' }
        ],
        [
          { text: '💎 Премиум', callback_data: 'help_premium' },
          { text: '🔄 Обновления', callback_data: 'help_updates' }
        ],
        [
          { text: '📞 Поддержка', callback_data: 'help_support' },
          { text: '🐞 Сообщить об ошибке', callback_data: 'help_bug' }
        ],
        [
          { text: '🔙 Назад', callback_data: 'back_to_menu' }
        ]
      ]
    };

    await bot.sendMessage(chatId, '❓ *Центр помощи*\n\n' +
      'Выберите интересующий раздел:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ СТАТИСТИКИ
  showStatsMenu: async (bot, chatId, userStats) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📈 График активности', callback_data: 'stats_graph' },
          { text: '🏆 Топ пользователей', callback_data: 'stats_top' }
        ],
        [
          { text: '🎯 Мои достижения', callback_data: 'stats_achievements' },
          { text: '📅 История', callback_data: 'stats_history' }
        ],
        [
          { text: '🔄 Обновить', callback_data: 'stats_refresh' },
          { text: '📊 Детальная статистика', callback_data: 'stats_detailed' }
        ],
        [
          { text: '🔙 Назад', callback_data: 'back_to_menu' }
        ]
      ]
    };

    const statsMessage = userStats ? 
      `📊 *Ваша статистика*\n\n` +
      `👤 Имя: ${userStats.username}\n` +
      `🎨 Стикеров: ${userStats.stickers_count}\n` +
      `📂 Папок: ${userStats.folders_count || 0}\n` +
      `⭐ Рейтинг: ${userStats.rating}/10\n` +
      `📅 С вами с: ${new Date(userStats.created_at).toLocaleDateString('ru-RU')}` :
      `📊 *Статистика*\n\nЗагрузка данных...`;

    await bot.sendMessage(chatId, statsMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ ИЗБРАННОГО
  showFavoritesMenu: async (bot, chatId, favorites = []) => {
    const keyboard = {
      inline_keyboard: []
    };

    if (favorites.length > 0) {
      // Показываем избранные стикеры
      const favButtons = favorites.map((fav, index) => {
        if (index % 2 === 0) {
          return [{ 
            text: `⭐ ${index + 1}`, 
            callback_data: `fav_${fav.id}` 
          }];
        }
        return [];
      }).filter(arr => arr.length > 0);

      keyboard.inline_keyboard.push(...favButtons);
    }

    keyboard.inline_keyboard.push(
      [
        { text: '➕ Добавить в избранное', callback_data: 'add_favorite' },
        { text: '🗑️ Удалить из избранного', callback_data: 'remove_favorite' }
      ],
      [
        { text: '🔙 Назад', callback_data: 'back_to_menu' }
      ]
    );

    const message = favorites.length === 0
      ? '⭐ *Избранное*\nДобавляйте сюда лучшие стикеры!'
      : `⭐ *Избранное*\nВаши любимые стикеры: ${favorites.length}`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ СОЗДАНИЯ ПАПКИ
  showCreateFolderMenu: async (bot, chatId) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📁 Рабочие', callback_data: 'folder_work' },
          { text: '😊 Мемы', callback_data: 'folder_memes' }
        ],
        [
          { text: '❤️ Любимые', callback_data: 'folder_love' },
          { text: '🎨 Творчество', callback_data: 'folder_art' }
        ],
        [
          { text: '📷 Фото', callback_data: 'folder_photos' },
          { text: '✨ Эффекты', callback_data: 'folder_effects' }
        ],
        [
          { text: '✏️ Свое название', callback_data: 'folder_custom' },
          { text: '🚫 Отмена', callback_data: 'cancel' }
        ]
      ]
    };

    await bot.sendMessage(chatId, '📂 *Создание папки*\n\n' +
      'Выберите готовый шаблон или создайте свою:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ УДАЛЕНИЯ
  showDeleteMenu: async (bot, chatId, type = 'sticker') => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Да, удалить', callback_data: `delete_${type}_confirm` },
          { text: '❌ Нет, отменить', callback_data: 'cancel' }
        ]
      ]
    };

    const messages = {
      sticker: '🗑️ *Удаление стикера*\nВы уверены, что хотите удалить этот стикер?',
      folder: '🗑️ *Удаление папки*\nВсе стикеры в папке будут удалены. Вы уверены?',
      all: '🗑️ *Очистка всех данных*\nЭто удалит все ваши стикеры и папки. Необратимо!'
    };

    await bot.sendMessage(chatId, messages[type] || messages.sticker, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ ТЕКСТА ДЛЯ СТИКЕРА
  showTextMenu: async (bot, chatId) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '😊 Смайлы', callback_data: 'text_emojis' },
          { text: '🔡 Шрифты', callback_data: 'text_fonts' }
        ],
        [
          { text: '🎨 Цвета', callback_data: 'text_colors' },
          { text: '🔲 Позиция', callback_data: 'text_position' }
        ],
        [
          { text: '✨ Эффекты текста', callback_data: 'text_effects' },
          { text: '📐 Размер', callback_data: 'text_size' }
        ],
        [
          { text: '✅ Готово', callback_data: 'text_done' },
          { text: '🚫 Без текста', callback_data: 'text_none' }
        ]
      ]
    };

    await bot.sendMessage(chatId, '📝 *Добавление текста*\n\n' +
      'Настройте текст для стикера:', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  },

  // МЕНЮ ЦВЕТОВ ДЛЯ РАМКИ
  showColorMenu: async (bot, chatId) => {
    const keyboard = {
      inline_keyboard: [
        [
          { text: '⬜️ Белый', callback_data: 'color_white' },
          { text: '⬛️ Черный', callback_data: 'color_black' },
          { text: '🟥 Красный', callback_data: 'color_red' }
        ],
        [
          { text: '🟦 Синий', callback_data: 'color_blue' },
          { text: '🟩 Зеленый', callback_data: 'color_green' },
          { text: '🟨 Желтый', callback_data: 'color_yellow' }
        ],
        [
          { text: '🟪 Фиолетовый', callback_data: 'color_purple' },
          { text: '🟧 Оранжевый', callback_data: 'color_orange' },
          { text: '🌸 Розовый', callback_data: 'color_pink' }
        ],
        [
          { text: '🌈 Градиент', callback_data: 'color_gradient' },
          { text: '✨ Золото', callback_data: 'color_gold' },
          { text: '💎 Серебро', callback_data: 'color_silver' }
        ],
        [
          { text: '🔙 Назад', callback_data: 'back_to_colors' }
        ]
      ]
    };

    await bot.sendMessage(chatId, '🎨 *Выберите цвет рамки:*', {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};
