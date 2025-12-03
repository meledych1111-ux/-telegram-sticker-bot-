// 📱 КРАСИВОЕ МЕНЮ ДЛЯ ТЕЛЕГРАМ БОТА С ДОПОЛНИТЕЛЬНЫМИ ФУНКЦИЯМИ
class MenuBuilder {
  
  // 🏠 ГЛАВНОЕ МЕНЮ
  static getMainMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🎨 Создать стикер' }],
          [{ text: '⭐ Избранное' }, { text: '📚 Мои подборки' }],
          [{ text: '🎭 Эффекты' }, { text: '📊 Статистика' }],
          [{ text: '🏆 Топ' }, { text: 'ℹ️ Помощь' }],
          [{ text: '⚙️ Управление' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // ⚙️ МЕНЮ УПРАВЛЕНИЯ
  static getManagementMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '📋 Мои стикеры' }, { text: '🗑️ Удалить стикер' }],
          [{ text: '🗂️ Управление подборками' }],
          [{ text: '🔙 Назад' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // 🗂️ МЕНЮ УПРАВЛЕНИЯ ПОДБОРКАМИ
  static getCollectionsManagementMenu(collections = []) {
    const buttons = [];
    
    if (collections.length === 0) {
      buttons.push([{ text: '📁 Создать подборку' }]);
    } else {
      collections.slice(0, 5).forEach(collection => {
        buttons.push([{ 
          text: `📂 ${collection.name} (${collection.stickers_count || 0})` 
        }]);
      });
    }
    
    buttons.push([
      { text: '➕ Создать подборку' },
      { text: '🗑️ Удалить подборку' }
    ]);
    buttons.push([{ text: '🔙 Назад' }]);
    
    return {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // 📋 МЕНЮ МОИХ СТИКЕРОВ
  static getMyStickersMenu(stickers = []) {
    const buttons = [];
    
    if (stickers.length === 0) {
      buttons.push([{ text: '🎨 Создать первый стикер' }]);
    } else {
      stickers.slice(0, 5).forEach((sticker, index) => {
        buttons.push([{ 
          text: `🖼️ Стикер ${index + 1} (${sticker.effect_applied || 'без эффекта'})` 
        }]);
      });
    }
    
    buttons.push([
      { text: '🗑️ Удалить стикер' },
      { text: '🔙 Назад' }
    ]);
    
    return {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // 🗑️ МЕНЮ УДАЛЕНИЯ СТИКЕРОВ
  static getDeleteStickersMenu(stickers = []) {
    const buttons = [];
    
    if (stickers.length === 0) {
      buttons.push([{ text: '📭 Нет стикеров для удаления' }]);
    } else {
      stickers.slice(0, 8).forEach((sticker, index) => {
        const effect = sticker.effect_applied === 'none' ? 'без эффекта' : sticker.effect_applied;
        buttons.push([{ 
          text: `🗑️ ${index + 1}. ${effect} (${new Date(sticker.created_at).toLocaleDateString()})` 
        }]);
      });
    }
    
    buttons.push([{ text: '🔙 Назад' }]);
    
    return {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // 🗑️ МЕНЮ УДАЛЕНИЯ ПОДБОРОК
  static getDeleteCollectionsMenu(collections = []) {
    const buttons = [];
    
    if (collections.length === 0) {
      buttons.push([{ text: '📭 Нет подборок для удаления' }]);
    } else {
      collections.slice(0, 8).forEach((collection, index) => {
        buttons.push([{ 
          text: `🗑️ ${index + 1}. ${collection.name} (${collection.stickers_count || 0} стикеров)` 
        }]);
      });
    }
    
    buttons.push([{ text: '🔙 Назад' }]);
    
    return {
      reply_markup: {
        keyboard: buttons,
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  // 🎭 МЕНЮ ЭФФЕКТОВ
  static getEffectsMenu(effects = []) {
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
  static getCollectionsMenu(collections = []) {
    const buttons = [];
    
    if (collections.length === 0) {
      buttons.push([{ text: '📁 Создать первую подборку' }]);
    } else {
      // Показываем максимум 5 подборок
      collections.slice(0, 5).forEach(collection => {
        buttons.push([{ 
          text: `📂 ${collection.name} (${collection.stickers_count || 0})` 
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
          [{ text: '🗑️ Удалить из избранного' }],
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
          ],
          [
            { text: '🗑️ Удалить', callback_data: `del_${stickerId}` }
          ]
        ]
      }
    };
  }

  // 🆕 КНОПКА СТАРТ
  static getStartMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🚀 Начать создавать стикеры!' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };
  }
}

module.exports = MenuBuilder;
