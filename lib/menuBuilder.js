// 📋  lib/menuBuilder.js – сборка клавиатур
const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: '🎨 Создать стикер' }],
      [{ text: '🎭 Эффекты' }, { text: '⭐ Избранное' }],
      [{ text: '📚 Мои подборки' }, { text: '📊 Статистика' }],
      [{ text: 'ℹ️ Помощь' }]
    ],
    resize_keyboard: true
  }
};

const removeMenu = { reply_markup: { remove_keyboard: true } };

const effectsMenu = (effects) => ({
  reply_markup: {
    keyboard: [
      ...effects.map(e => [{ text: e.name }]),
      [{ text: '🔙 Назад' }]
    ],
    resize_keyboard: true
  }
});

const stickerActions = (stickerId) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '⭐ В избранное', callback_data: `fav_${stickerId}` }],
      [{ text: '📁 В подборку', callback_data: `col_${stickerId}` }]
    ]
  }
});

module.exports = { getMainMenu: () => mainMenu, removeMenu, getEffectsMenu: effectsMenu, getStickerActions: stickerActions };
