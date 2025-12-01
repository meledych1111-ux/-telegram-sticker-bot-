// ================= КНОПОЧНЫЕ МЕНЮ ДЛЯ TELEGRAM БОТА =================

// ГЛАВНОЕ МЕНЮ (Reply Keyboard - постоянные кнопки внизу)
const showMainMenu = async (bot, chatId) => {
  const menu = {
    reply_markup: {
      keyboard: [
        [{ text: '🎨 Создать стикер' }, { text: '📁 Мои стикеры' }],
        [{ text: '📂 Папки' }, { text: '⭐ Избранное' }],
        [{ text: '📊 Статистика' }, { text: '⚙️ Настройки' }],
        [{ text: 'ℹ️ Помощь' }, { text: '👑 Топ' }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      input_field_placeholder: 'Выберите действие или отправьте фото 📸'
    }
  };

  await bot.sendMessage(chatId, 
    '✨ *Главное меню Sticker Bot*\n\n' +
    'Выберите действие или отправьте мне фото для создания стикера!',
    { parse_mode: 'Markdown', ...menu }
  );
};

// МЕНЮ ЭФФЕКТОВ (Inline Keyboard - внутри сообщения)
const showEffectsMenu = async (bot, chatId) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📝 Добавить текст', callback_data: 'effect_text' },
        { text: '🖼️ Рамка', callback_data: 'effect_frame' }
      ],
      [
        { text: '✨ Перламутр', callback_data: 'effect_pearl' },
        { text: '🌈 Градиент', callback_data: 'effect_gradient' }
      ],
      [
        { text: '🎭 Без эффектов', callback_data: 'effect_none' },
        { text: '❌ Отмена', callback_data: 'cancel' }
      ],
      [
        { text: '✅ ГОТОВО', callback_data: 'effect_finish', 
          style: { background: '#4CAF50', color: '#FFFFFF' } }
      ]
    ]
  };

  await bot.sendMessage(chatId,
    '🎨 *Выберите эффекты для стикера:*\n\n' +
    '• 📝 **Текст** - добавить надпись\n' +
    '• 🖼️ **Рамка** - цветная рамка\n' +
    '• ✨ **Перламутр** - мерцающий эффект\n' +
    '• 🌈 **Градиент** - цветной переход\n' +
    '• 🎭 **Без эффектов** - только обрезка',
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
};

// МЕНЮ ЦВЕТОВ РАМКИ
const showColorMenu = async (bot, chatId) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '⚪️ Белый', callback_data: 'color_white' },
        { text: '⚫️ Черный', callback_data: 'color_black' },
        { text: '🔴 Красный', callback_data: 'color_red' }
      ],
      [
        { text: '🔵 Синий', callback_data: 'color_blue' },
        { text: '🟢 Зеленый', callback_data: 'color_green' },
        { text: '🟡 Желтый', callback_data: 'color_yellow' }
      ],
      [
        { text: '🟣 Фиолетовый', callback_data: 'color_purple' },
        { text: '🟠 Оранжевый', callback_data: 'color_orange' },
        { text: '🌸 Розовый', callback_data: 'color_pink' }
      ],
      [
        { text: '✨ Золото', callback_data: 'color_gold' },
        { text: '💎 Серебро', callback_data: 'color_silver' },
        { text: '🌈 Градиент', callback_data: 'color_gradient' }
      ],
      [
        { text: '🔙 Назад', callback_data: 'back_to_effects' }
      ]
    ]
  };

  await bot.sendMessage(chatId, '🎨 *Выберите цвет рамки:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// МЕНЮ ПАПОК
const showFoldersMenu = async (bot, chatId, folders = []) => {
  const keyboard = {
    inline_keyboard: []
  };

  // Добавляем кнопки папок (максимум 8)
  if (folders.length > 0) {
    const folderRows = [];
    folders.slice(0, 8).forEach((folder, index) => {
      if (index % 2 === 0) folderRows.push([]);
      folderRows[folderRows.length - 1].push({
        text: `📂 ${folder.name.substring(0, 15)}`,
        callback_data: `folder_${folder.id}`
      });
    });
    keyboard.inline_keyboard.push(...folderRows);
  }

  // Кнопки действий
  keyboard.inline_keyboard.push(
    [
      { text: '➕ Создать папку', callback_data: 'create_folder' },
      { text: '🗑️ Удалить', callback_data: 'delete_folder_menu' }
    ],
    [
      { text: '📥 Импорт', callback_data: 'import_stickers' },
      { text: '📤 Экспорт', callback_data: 'export_stickers' }
    ],
    [
      { text: '🔙 Главное меню', callback_data: 'back_to_main' }
    ]
  );

  const message = folders.length === 0
    ? '📂 *У вас пока нет папок*\n\nСоздайте первую папку для хранения стикеров!'
    : `📂 *Ваши папки*\n\nВсего папок: ${folders.length}\nВыберите папку:`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// МЕНЮ СТИКЕРОВ
const showStickersMenu = async (bot, chatId, stickers = []) => {
  const keyboard = {
    inline_keyboard: []
  };

  // Кнопки стикеров (номера)
  if (stickers.length > 0) {
    const stickerRows = [];
    for (let i = 0; i < Math.min(6, stickers.length); i++) {
      if (i % 3 === 0) stickerRows.push([]);
      stickerRows[stickerRows.length - 1].push({
        text: `🎨 ${i + 1}`,
        callback_data: `view_sticker_${stickers[i].id}`
      });
    }
    keyboard.inline_keyboard.push(...stickerRows);
  }

  // Кнопки навигации
  keyboard.inline_keyboard.push(
    [
      { text: '⬅️ Назад', callback_data: 'prev_page' },
      { text: `${stickers.length} шт`, callback_data: 'count' },
      { text: 'Вперед ➡️', callback_data: 'next_page' }
    ],
    [
      { text: '⭐ В избранное', callback_data: 'add_to_fav' },
      { text: '🗑️ Удалить', callback_data: 'delete_sticker_menu' }
    ],
    [
      { text: '🔙 Главное меню', callback_data: 'back_to_main' }
    ]
  );

  const message = stickers.length === 0
    ? '📭 *У вас пока нет стикеров*\n\nСоздайте первый стикер через меню "🎨 Создать стикер"!'
    : `🎨 *Ваши стикеры*\n\nВсего: ${stickers.length} стикеров\nВыберите стикер:`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// МЕНЮ СТАТИСТИКИ
const showStatsMenu = async (bot, chatId, stats = {}) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📈 График', callback_data: 'stats_graph' },
        { text: '🏆 Топ', callback_data: 'stats_top' }
      ],
      [
        { text: '🎯 Достижения', callback_data: 'stats_achievements' },
        { text: '📅 История', callback_data: 'stats_history' }
      ],
      [
        { text: '🔄 Обновить', callback_data: 'stats_refresh' },
        { text: '📊 Подробно', callback_data: 'stats_detailed' }
      ],
      [
        { text: '🔙 Главное меню', callback_data: 'back_to_main' }
      ]
    ]
  };

  const statsText = stats.username 
    ? `📊 *Статистика пользователя*\n\n` +
      `👤 Имя: ${stats.username}\n` +
      `🎨 Стикеров: ${stats.stickers_count || 0}\n` +
      `⭐ Рейтинг: ${stats.rating || 5}/10\n` +
      `📅 Регистрация: ${new Date(stats.created_at).toLocaleDateString('ru-RU')}`
    : `📊 *Статистика*\n\nЗагрузка данных...`;

  await bot.sendMessage(chatId, statsText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// МЕНЮ НАСТРОЕК
const showSettingsMenu = async (bot, chatId) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '👤 Профиль', callback_data: 'settings_profile' },
        { text: '🔔 Уведомления', callback_data: 'settings_notify' }
      ],
      [
        { text: '🎨 Качество', callback_data: 'settings_quality' },
        { text: '💾 Автосохранение', callback_data: 'settings_autosave' }
      ],
      [
        { text: '🗑️ Очистить кеш', callback_data: 'settings_clear' },
        { text: '🌙 Тема', callback_data: 'settings_theme' }
      ],
      [
        { text: '🔙 Главное меню', callback_data: 'back_to_main' },
        { text: '❓ Помощь', callback_data: 'settings_help' }
      ]
    ]
  };

  await bot.sendMessage(chatId,
    '⚙️ *Настройки бота*\n\n' +
    'Настройте внешний вид и поведение бота:',
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
};

// МЕНЮ ПОМОЩИ
const showHelpMenu = async (bot, chatId) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '📖 Создание стикера', callback_data: 'help_create' },
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
        { text: '🐞 Ошибка', callback_data: 'help_bug' }
      ],
      [
        { text: '🔙 Главное меню', callback_data: 'back_to_main' }
      ]
    ]
  };

  await bot.sendMessage(chatId,
    '❓ *Центр помощи*\n\n' +
    'Выберите интересующий раздел:',
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );
};

// МЕНЮ УДАЛЕНИЯ (подтверждение)
const showDeleteConfirmMenu = async (bot, chatId, type = 'sticker', itemName = '') => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ ДА, удалить', callback_data: `delete_${type}_confirm` },
        { text: '❌ НЕТ, отмена', callback_data: 'cancel_delete' }
      ]
    ]
  };

  const messages = {
    sticker: `🗑️ *Удаление стикера*\n\nВы уверены, что хотите удалить этот стикер?`,
    folder: `🗑️ *Удаление папки*\n\nПапка "${itemName}" и все стикеры в ней будут удалены!\nВы уверены?`,
    all: `⚠️ *Очистка всех данных*\n\nВсе ваши стикеры и папки будут удалены!\nЭто действие необратимо!\n\nВы уверены?`
  };

  await bot.sendMessage(chatId, messages[type] || messages.sticker, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// МЕНЮ ИЗБРАННОГО
const showFavoritesMenu = async (bot, chatId, favorites = []) => {
  const keyboard = {
    inline_keyboard: []
  };

  if (favorites.length > 0) {
    const favRows = [];
    favorites.slice(0, 6).forEach((fav, index) => {
      if (index % 3 === 0) favRows.push([]);
      favRows[favRows.length - 1].push({
        text: `⭐ ${index + 1}`,
        callback_data: `fav_${fav.id}`
      });
    });
    keyboard.inline_keyboard.push(...favRows);
  }

  keyboard.inline_keyboard.push(
    [
      { text: '➕ Добавить', callback_data: 'add_favorite' },
      { text: '🗑️ Удалить', callback_data: 'remove_favorite' }
    ],
    [
      { text: '🔙 Главное меню', callback_data: 'back_to_main' }
    ]
  );

  const message = favorites.length === 0
    ? '⭐ *Избранное пусто*\n\nДобавляйте сюда лучшие стикеры!'
    : `⭐ *Избранное*\n\nЛюбимых стикеров: ${favorites.length}`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// МЕНЮ ТОП ПОЛЬЗОВАТЕЛЕЙ
const showTopUsersMenu = async (bot, chatId, topUsers = []) => {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🏆 Топ за день', callback_data: 'top_day' },
        { text: '📈 Топ за неделю', callback_data: 'top_week' }
      ],
      [
        { text: '🎨 Топ за месяц', callback_data: 'top_month' },
        { text: '⭐ Топ за все время', callback_data: 'top_all' }
      ],
      [
        { text: '🔙 Главное меню', callback_data: 'back_to_main' }
      ]
    ]
  };

  let message = '👑 *Топ пользователей*\n\n';
  
  if (topUsers.length === 0) {
    message += 'Пока нет данных. Будьте первым! 🎨';
  } else {
    topUsers.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `▫️`;
      message += `${medal} ${user.username || 'Аноним'}\n`;
      message += `   🎨 ${user.stickers_count} стикеров | ⭐ ${user.rating}/10\n\n`;
    });
  }

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// ================= ЭКСПОРТ ВСЕХ ФУНКЦИЙ =================
module.exports = {
  showMainMenu,
  showEffectsMenu,
  showColorMenu,
  showFoldersMenu,
  showStickersMenu,
  showStatsMenu,
  showSettingsMenu,
  showHelpMenu,
  showDeleteConfirmMenu,
  showFavoritesMenu,
  showTopUsersMenu
};
