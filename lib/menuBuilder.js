// lib/menuBuilder.js
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

const effectsMenu = (effects = []) => ({
  reply_markup: {
    keyboard: effects.length
      ? [...effects.map(e => [{ text: e.name }]), [{ text: '🔙 Назад' }]]
      : [[{ text: 'Нет эффектов' }], [{ text: '🔙 Назад' }]],
    resize_keyboard: true
  }
});

const stickerActions = (stickerId) => ({
  reply_markup: {
    inline_keyboard: [
      [{ text: '⭐ В избранное', callback_data: `f_${stickerId}` }],
      [{ text: '📁 В подборку', callback_data: `c_${stickerId}` }]
    ]
  }
});

module.exports = {
  getMainMenu: () => mainMenu,
  removeMenu,
  getEffectsMenu: effectsMenu,
  getStickerActions: stickerActions
};
