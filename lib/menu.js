// Production-ready меню для Telegram бота

module.exports = {
  // Главное меню
  mainMenu: (username = 'Пользователь') => ({
    reply_markup: {
      keyboard: [
        [
          { text: "🎨 Создать стикер", web_app: { url: process.env.WEB_APP_URL || "https://your-app.vercel.app/editor" } },
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

  // Меню эффектов (inline)
  effectsMenu: (hasPremium = false) => {
    const buttons = [
      [
        { text: "🖼️ Рамка", callback_data: "effect_frame" },
        { text: "✨ Перламутр", callback_data: "effect_pearl" },
        { text: "🌈 Градиент", callback_data: "effect_gradient" }
      ],
      [
        { text: "📝 Добавить текст", callback_data: "effect_text" },
        { text: "🎭 Фильтры", callback_data: "effect_filters" },
        { text: "🔲 Обрезка", callback_data: "effect_crop" }
      ]
    ];
    
    if (hasPremium) {
      buttons.push([
        { text: "🌟 Премиум-эффекты", callback_data: "premium_effects" },
        { text: "🎬 Анимация", callback_data: "effect_animation" }
      ]);
    }
    
    buttons.push([
      { text: "✅ Применить", callback_data: "apply_effects" },
      { text: "❌ Отмена", callback_data: "cancel_effects" }
    ]);
    
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  },

  // Меню цветов рамки
  frameColorsMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⚪ Белый", callback_data: "color_white" },
          { text: "⚫ Черный", callback_data: "color_black" },
          { text: "🔴 Красный", callback_data: "color_red" }
        ],
        [
          { text: "🔵 Синий", callback_data: "color_blue" },
          { text: "🟢 Зеленый", callback_data: "color_green" },
          { text: "🟡 Желтый", callback_data: "color_yellow" }
        ],
        [
          { text: "🟣 Фиолетовый", callback_data: "color_purple" },
          { text: "🩷 Розовый", callback_data: "color_pink" },
          { text: "🟠 Оранжевый", callback_data: "color_orange" }
        ],
        [
          { text: "🌟 Золотой", callback_data: "color_gold" },
          { text: "💎 Серебряный", callback_data: "color_silver" },
          { text: "🌈 Градиент", callback_data: "color_gradient" }
        ],
        [
          { text: "◀️ Назад", callback_data: "back_to_effects" }
        ]
      ]
    }
  }),

  // Действия со стикером
  stickerActionsMenu: (stickerId, isOwner = true) => {
    const buttons = [
      [
        { text: "⭐ Оценить", callback_data: `rate_${stickerId}` },
        { text: "📥 Скачать", callback_data: `download_${stickerId}` },
        { text: "🔗 Поделиться", callback_data: `share_${stickerId}` }
      ]
    ];
    
    if (isOwner) {
      buttons.push([
        { text: "✏️ Переименовать", callback_data: `rename_${stickerId}` },
        { text: "📂 В папку", callback_data: `to_folder_${stickerId}` },
        { text: "🗑️ Удалить", callback_data: `delete_${stickerId}` }
      ]);
    }
    
    buttons.push([
      { text: "🔄 Создать похожий", callback_data: `similar_${stickerId}` },
      { text: "🚫 Пожаловаться", callback_data: `report_${stickerId}` }
    ]);
    
    return {
      reply_markup: {
        inline_keyboard: buttons
      }
    };
  },

  // Меню папок
  foldersMenu: (folders = [], hasPremium = false) => {
    const buttons = [];
    const maxFolders = hasPremium ? 20 : 5;
    
    // Отображаем папки
    folders.slice(0, maxFolders).forEach(folder => {
      buttons.push([
        { 
          text: `${folder.sticker_count > 0 ? '📁' : '📂'} ${folder.name} (${folder.sticker_count})`,
          callback_data: `open_folder_${folder.id}`
        }
      ]);
    });
    
    // Если папок больше лимита
    if (folders.length > maxFolders && !hasPremium) {
      buttons.push([
        { text: "🔓 Разблокировать больше папок (Premium)", callback_data: "premium_folders" }
      ]);
    }
    
    // Кнопки действий
    if (folders.length < maxFolders) {
      buttons.push([
        { text: "➕ Создать папку", callback_data: "create_folder" },
        { text: "✏️ Редактировать", callback_data: "edit_folders" }
      ]);
    }
    
    buttons.push([
      { text: "◀️ В главное меню", callback_data: "back_to_main" }
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
          { text: "✏️ С комментарием", callback_data: `rate_with_comment_${stickerId}` },
          { text: "◀️ Назад", callback_data: `back_to_sticker_${stickerId}` }
        ]
      ]
    }
  }),

  // Меню настроек
  settingsMenu: (userData) => ({
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: userData?.notifications ? "🔔 Уведомления ✅" : "🔕 Уведомления ❌", 
            callback_data: "toggle_notifications" 
          },
          { text: "🌐 Язык", callback_data: "change_language" }
        ],
        [
          { text: "🔒 Приватность", callback_data: "privacy_settings" },
          { text: "🎨 Тема", callback_data: "theme_settings" }
        ],
        [
          { text: "💾 Экспорт данных", callback_data: "export_data" },
          { text: "🗑️ Очистить историю", callback_data: "clear_history" }
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
          { text: "❌ Нет, отмена", callback_data: `cancel_delete_${itemType}_${itemId}` }
        ]
      ]
    }
  }),

  // Меню премиума
  premiumMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🌟 Преимущества Premium", callback_data: "premium_features" },
          { text: "💎 Купить Premium", callback_data: "buy_premium" }
        ],
        [
          { text: "📋 Моя подписка", callback_data: "my_subscription" },
          { text: "🎁 Подарить Premium", callback_data: "gift_premium" }
        ],
        [
          { text: "❓ FAQ", callback_data: "premium_faq" },
          { text: "◀️ Назад", callback_data: "back_to_settings" }
        ]
      ]
    }
  })
};
