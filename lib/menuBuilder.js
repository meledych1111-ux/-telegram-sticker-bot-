// lib/menuBuilder.js - ОБНОВЛЕННЫЙ БЕЗ ЭФФЕКТОВ
class MenuBuilder {
  static getStartMenu() {
    return {
      reply_markup: {
        keyboard: [
          ['🚀 Начать создавать стикеры!'],
          ['ℹ️ Помощь', '📊 Статистика']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  static getMainMenu() {
    return {
      reply_markup: {
        keyboard: [
          ['🎨 Создать стикер'],
          ['⭐ Избранное', '📚 Мои подборки'],
          ['📊 Статистика', '🏆 Топ'],
          ['ℹ️ Помощь']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  static getFavoritesMenu() {
    return {
      reply_markup: {
        keyboard: [
          ['👀 Просмотреть избранное'],
          ['🗑️ Удалить из избранного'],
          ['🔙 Назад']
        ],
        resize_keyboard: true
      }
    };
  }

  static getCollectionsMenu() {
    return {
      reply_markup: {
        keyboard: [
          ['📁 Создать первую подборку'],
          ['👀 Мои подборки'],
          ['🔙 Назад']
        ],
        resize_keyboard: true
      }
    };
  }

  static getStickerActions(stickerId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⭐ В избранное', callback_data: `fav_${stickerId}` },
            { text: '📁 В подборку', callback_data: `col_${stickerId}` }
          ],
          [
            { text: '🔄 Создать еще', callback_data: 'remake_sticker' },
            { text: '🗑️ Удалить', callback_data: `del_${stickerId}` }
          ]
        ]
      }
    };
  }

  static removeMenu() {
    return {
      reply_markup: {
        remove_keyboard: true
      }
    };
  }
}

module.exports = MenuBuilder;
