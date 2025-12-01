// Красивые меню для бота
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
          { text: "👑 Топ" }
        ],
        [
          { text: "⚙️ Настройки" },
          { text: "ℹ️ Помощь" }
        ]
      ],
      resize_keyboard: true,
      input_field_placeholder: `Привет, ${username}! Выберите действие...`,
      one_time_keyboard: false
    }
  }),

  // Меню эффектов
  effectsMenu: () => ({
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🖼️ Рамка", callback_data: "effect_frame" },
          { text: "✨ Перламутр", callback_data: "effect_pearl" }
        ],
        [
          { text: "✅ Применить", callback_data: "apply_effects" },
          { text: "❌ Отмена", callback_data: "cancel" }
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
          { text: "📥 Скачать", callback_data: `download_${stickerId}` }
        ]
      ]
    }
  })
};
