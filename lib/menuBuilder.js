// 📱 КРАСИВОЕ МЕНЮ ДЛЯ ТЕЛЕГРАМ БОТА
class MenuBuilder {
  
  // 🏠 ГЛАВНОЕ МЕНЮ
  static getMainMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🎨 Создать стикер' }, { text: '⭐ Избранное' }],
          [{ text: '📚 Мои подборки' }, { text: '🎭 Эффекты' }],
          [{ text: '📊 Статистика' }, { text: '🏆 Топ' }],
          [{ text: 'ℹ️ Помощь' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // 🎭 МЕНЮ ЭФФЕКТОВ
  static getEffectsMenu(effects) {
    const buttons = [];
    
    // Группируем по 2 эффекта в строку
    for (let i = 0; i < effects.length; i += 2) {
      const row = effects.slice(i, i + 2).map(effect => ({
        text: effect.is_premium ? `💎 ${effect.name}` : effect.name
      }));
      buttons.push(row);
    }
    
    // Добавляем кнопку назад
    buttons.push([{ text: '🔙 Назад' }]);
    
    return {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // 📚 МЕНЮ ПОДБОРОК
  static getCollectionsMenu(collections) {
    const buttons = [];
    
    if (collections.length === 0) {
      buttons.push([{ text: '📁 Создать первую подборку' }]);
    } else {
      collections.forEach(collection => {
        buttons.push([{ 
          text: `📂 ${collection.name} (${collection.stickers_count})` 
        }]);
      });
    }
    
    buttons.push([{ text: '➕ Новая подборка' }, { text: '🔙 Назад' }]);
    
    return {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // ⭐ МЕНЮ ИЗБРАННОГО
  static getFavoritesMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '👀 Просмотреть избранное' }],
          [{ text: '🗑️ Очистить избранное' }],
          [{ text: '🔙 Назад' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // ❌ СКРЫТЬ МЕНЮ
  static removeMenu() {
    return {
      reply_markup: {
        remove_keyboard: true
      }
    };
  }

  // 🔘 INLINE КНОПКИ ДЛЯ БЫСТРЫХ ДЕЙСТВИЙ
  static getStickerActions(stickerId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⭐ В избранное', callback_data: `fav_${stickerId}` },
            { text: '📁 В подборку', callback_data: `col_${stickerId}` }
          ],
          [
            { text: '🎭 Эффекты', callback_data: `eff_${stickerId}` },
            { text: '🔄 Пересоздать', callback_data: `remake_${stickerId}` }
          ]
        ]
      }
    };
  }
}

module.exports = MenuBuilder;
