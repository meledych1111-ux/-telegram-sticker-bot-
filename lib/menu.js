// Полный набор меню для Telegram бота

module.exports = {
  // Главное меню
  mainMenu: (username = 'Пользователь') => ({
    reply_markup: {
      keyboard: [
        [
          { text: "🎨 Создать стикер" },
          { text: "📁 Мои стикеры" }
        ],
        [
          { text: "📂 Папки" },
          { text: "⭐ Избранное" }
        ],
        [
          { text: "📊 Статистика" },
          { text: "👑 Топ 10" }
        ],
        [
          { text: "⚙️ Настройки" },
          { text: "🆘 Помощь" }
        ]
      ],
      resize_keyboard: true,
      input_field_placeholder: `👋 Привет, ${username}! Выберите действие...`,
      one_time_keyboard: false,
      selective: true
    }
  }),

  // Меню эффектов
  effectsMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🖼️ Рамка", callback_data: "effect_frame" },
          { text: "✨ Перламутр", callback_data: "effect_pearl" },
          { text: "🌈 Градиент", callback_data: "effect_gradient" }
        ],
        [
          { text: "📝 Текст", callback_data: "effect_text" },
          { text: "🎭 Фильтры", callback_data: "effect_filters" },
          { text: "🔲 Обрезка", callback_data: "effect_crop" }
        ],
        [
          { text: "⚪ Белая рамка", callback_data: "color_white" },
          { text: "⚫ Черная рамка", callback_data: "color_black" },
          { text: "🔴 Красная рамка", callback_data: "color_red" }
        ],
        [
          { text: "🔵 Синяя рамка", callback_data: "color_blue" },
          { text: "🟢 Зеленая рамка", callback_data: "color_green" },
          { text: "🟡 Желтая рамка", callback_data: "color_yellow" }
        ],
        [
          { text: "✅ Применить все", callback_data: "apply_all_effects" },
          { text: "❌ Сбросить", callback_data: "reset_effects" }
        ],
        [
          { text: "➡️ Далее", callback_data: "effects_next" }
        ]
      ]
    }
  }),

  // Меню текста
  textMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✨ Лучший!", callback_data: "text_best" },
          { text: "😍 Любовь", callback_data: "text_love" },
          { text: "🔥 Горячо", callback_data: "text_hot" }
        ],
        [
          { text: "⭐ Звезда", callback_data: "text_star" },
          { text: "🎉 Праздник", callback_data: "text_party" },
          { text: "💎 Премиум", callback_data: "text_premium" }
        ],
        [
          { text: "📝 Свой текст", callback_data: "text_custom" },
          { text: "◀️ Назад", callback_data: "back_to_effects" }
        ]
      ]
    }
  }),

  // Меню фильтров
  filtersMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🕰️ Винтаж", callback_data: "filter_vintage" },
          { text: "🎨 Неон", callback_data: "filter_neon" },
          { text: "❄️ Холодный", callback_data: "filter_cold" }
        ],
        [
          { text: "☀️ Теплый", callback_data: "filter_warm" },
          { text: "🌙 Ночной", callback_data: "filter_night" },
          { text: "🌈 Радуга", callback_data: "filter_rainbow" }
        ],
        [
          { text: "📸 Ч/Б", callback_data: "filter_bw" },
          { text: "🎬 Кино", callback_data: "filter_cinema" },
          { text: "🍭 Пастель", callback_data: "filter_pastel" }
        ],
        [
          { text: "◀️ Назад", callback_data: "back_to_effects" },
          { text: "✅ Применить", callback_data: "apply_filter" }
        ]
      ]
    }
  }),

  // Действия со стикером
  stickerActionsMenu: (stickerId) => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⭐ Оценить", callback_data: `rate_${stickerId}` },
          { text: "📥 Скачать", callback_data: `download_${stickerId}` },
          { text: "🔗 Поделиться", callback_data: `share_${stickerId}` }
        ],
        [
          { text: "📂 В папку", callback_data: `folder_${stickerId}` },
          { text: "✏️ Переименовать", callback_data: `rename_${stickerId}` },
          { text: "🗑️ Удалить", callback_data: `delete_${stickerId}` }
        ],
        [
          { text: "🔄 Создать похожий", callback_data: `similar_${stickerId}` },
          { text: "🚫 Пожаловаться", callback_data: `report_${stickerId}` }
        ]
      ]
    }
  }),

  // Меню папок
  foldersMenu: (folders = []) => {
    const buttons = [];
    
    // Отображаем папки (максимум 8)
    folders.slice(0, 8).forEach(folder => {
      const icon = folder.sticker_count > 0 ? '📁' : '📂';
      buttons.push([
        { 
          text: `${icon} ${folder.name} (${folder.sticker_count})`, 
          callback_data: `open_folder_${folder.id}`
        }
      ]);
    });
    
    // Кнопки действий
    if (folders.length < 20) {
      buttons.push([
        { text: "➕ Создать папку", callback_data: "create_folder" },
        { text: "✏️ Редактировать", callback_data: "edit_folders" }
      ]);
    }
    
    buttons.push([
      { text: "◀️ Назад", callback_data: "back_to_main" }
    ]);
    
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  },

  // Меню рейтинга
  ratingMenu: (stickerId) => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⭐ 1", callback_data: `rate_${stickerId}_1` },
          { text: "⭐⭐ 2", callback_data: `rate_${stickerId}_2` },
          { text: "⭐⭐⭐ 3", callback_data: `rate_${stickerId}_3` }
        ],
        [
          { text: "⭐⭐⭐⭐ 4", callback_data: `rate_${stickerId}_4` },
          { text: "⭐⭐⭐⭐⭐ 5", callback_data: `rate_${stickerId}_5` }
        ],
        [
          { text: "📝 С комментарием", callback_data: `rate_comment_${stickerId}` },
          { text: "◀️ Назад", callback_data: `back_to_sticker_${stickerId}` }
        ]
      ]
    }
  }),

  // Меню настроек
  settingsMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔔 Уведомления", callback_data: "settings_notifications" },
          { text: "🌐 Язык", callback_data: "settings_language" }
        ],
        [
          { text: "🔒 Приватность", callback_data: "settings_privacy" },
          { text: "🎨 Тема", callback_data: "settings_theme" }
        ],
        [
          { text: "💾 Экспорт данных", callback_data: "settings_export" },
          { text: "🗑️ Очистить историю", callback_data: "settings_clear" }
        ],
        [
          { text: "💰 Premium", callback_data: "premium_info" },
          { text: "📞 Поддержка", callback_data: "contact_support" }
        ],
        [
          { text: "◀️ Назад", callback_data: "back_to_main" },
          { text: "🔄 Сбросить", callback_data: "reset_settings" }
        ]
      ]
    }
  }),

  // Подтверждение удаления
  confirmDeleteMenu: (itemId, itemType = 'sticker') => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Да, удалить", callback_data: `confirm_delete_${itemType}_${itemId}` },
          { text: "❌ Нет, оставить", callback_data: `cancel_delete_${itemType}_${itemId}` }
        ]
      ]
    }
  }),

  // Меню премиума
  premiumMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🌟 Преимущества", callback_data: "premium_features" },
          { text: "💎 Купить Premium", callback_data: "buy_premium" }
        ],
        [
          { text: "📋 Моя подписка", callback_data: "my_subscription" },
          { text: "🎁 Подарить", callback_data: "gift_premium" }
        ],
        [
          { text: "❓ FAQ", callback_data: "premium_faq" },
          { text: "◀️ Назад", callback_data: "back_to_settings" }
        ]
      ]
    }
  }),

  // Быстрые эффекты
  quickEffectsMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✨ Магия", callback_data: "quick_magic" },
          { text: "🌈 Радуга", callback_data: "quick_rainbow" },
          { text: "💎 Кристалл", callback_data: "quick_crystal" }
        ],
        [
          { text: "🔥 Огонь", callback_data: "quick_fire" },
          { text: "💧 Вода", callback_data: "quick_water" },
          { text: "🌿 Природа", callback_data: "quick_nature" }
        ],
        [
          { text: "⚡ Молниеносно", callback_data: "apply_quick" },
          { text: "◀️ Назад", callback_data: "back_to_main" }
        ]
      ]
    }
  }),

  // Меню создания папки
  createFolderMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📁 Личное", callback_data: "folder_personal" },
          { text: "🎨 Творчество", callback_data: "folder_creative" },
          { text: "😄 Мемы", callback_data: "folder_memes" }
        ],
        [
          { text: "❤️ Любовь", callback_data: "folder_love" },
          { text: "🎉 Праздник", callback_data: "folder_holiday" },
          { text: "🐱 Животные", callback_data: "folder_animals" }
        ],
        [
          { text: "✏️ Свое название", callback_data: "folder_custom" },
          { text: "◀️ Назад", callback_data: "back_to_folders" }
        ]
      ]
    }
  }),

  // Меню выбора эмодзи
  emojiMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "😀", callback_data: "emoji_smile" },
          { text: "😂", callback_data: "emoji_laugh" },
          { text: "😍", callback_data: "emoji_love" },
          { text: "😎", callback_data: "emoji_cool" }
        ],
        [
          { text: "🤩", callback_data: "emoji_star" },
          { text: "🥳", callback_data: "emoji_party" },
          { text: "😭", callback_data: "emoji_cry" },
          { text: "🤔", callback_data: "emoji_think" }
        ],
        [
          { text: "👍", callback_data: "emoji_ok" },
          { text: "❤️", callback_data: "emoji_heart" },
          { text: "⭐", callback_data: "emoji_star2" },
          { text: "✨", callback_data: "emoji_sparkle" }
        ],
        [
          { text: "✅ Выбрано", callback_data: "emoji_selected" },
          { text: "◀️ Назад", callback_data: "back_to_sticker" }
        ]
      ]
    }
  })
};
