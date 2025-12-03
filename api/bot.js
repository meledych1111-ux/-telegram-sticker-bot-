// ⚡ ПОЛНОЦЕННЫЙ STICKER BOT С УПРАВЛЕНИЕМ
const MenuBuilder = require('../lib/menuBuilder');
const stickerCreator = require('../lib/stickerCreator');

// 📌 Подключение базы данных
let database;
try {
  database = require('../lib/database');
  console.log('✅ База данных Neon подключена');
} catch (error) {
  console.log('⚠️ База данных не доступна:', error.message);
  database = null;
}

// 📦 Хранилище временных данных пользователей
const userSessions = {};

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: '✅ Sticker Bot работает!',
      features: 'Стикеры, эффекты, избранное, подборки, рейтинг, удаление',
      commands: '/start, /help, /effects, /stats, /top, /manage'
    });
  }

  if (req.method === 'POST') {
    try {
      const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не настроен');
      
      const update = req.body;
      const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

      // 🔘 ОБРАБОТКА CALLBACK QUERY
      if (update.callback_query) {
        const callback = update.callback_query;
        const chatId = callback.message.chat.id;
        const data = callback.data;

        // Отвечаем на callback
        await answerCallbackQuery(BOT_URL, callback.id, '✅');

        if (data.startsWith('fav_')) {
          const stickerId = data.split('_')[1];
          if (database) {
            await database.addToFavorites(chatId, stickerId);
          }
          await sendMessage(BOT_URL, chatId, '⭐ Добавлено в избранное!', MenuBuilder.removeMenu());
        }
        else if (data.startsWith('del_')) {
          const stickerId = data.split('_')[1];
          if (database) {
            const deleted = await database.deleteSticker(chatId, stickerId);
            if (deleted) {
              await sendMessage(BOT_URL, chatId, '🗑️ Стикер удален!', MenuBuilder.getMainMenu());
            } else {
              await sendMessage(BOT_URL, chatId, '❌ Не удалось удалить стикер', MenuBuilder.getMainMenu());
            }
          }
        }
        else if (data.startsWith('col_')) {
          const stickerId = data.split('_')[1];
          userSessions[chatId] = { 
            stickerId: stickerId,
            waitingFor: 'collection_for_sticker'
          };
          await sendMessage(BOT_URL, chatId, 
            '📁 Выберите подборку для добавления стикера:',
            MenuBuilder.getCollectionsMenu()
          );
        }
        else if (data.startsWith('eff_')) {
          await showEffectsMenu(BOT_URL, chatId);
        }

        return res.status(200).json({ ok: true });
      }

      // 📨 ОБРАБОТКА СООБЩЕНИЯ
      if (update.message) {
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text || '';
        const username = message.from?.username || 'Пользователь';
        const firstName = message.from?.first_name || '';

        // 🆕 НАЧАЛО РАБОТЫ
        if (text === '/start') {
          if (database) {
            try {
              await database.saveUser(chatId, username, firstName);
            } catch (error) {
              console.log('⚠️ Не удалось сохранить пользователя:', error.message);
            }
          }
          
          await sendMessage(BOT_URL, chatId, 
            `👋 *Добро пожаловать, ${username}!* 🎨\n\n` +
            'Я помогу вам создавать крутые стикеры из ваших изображений!\n\n' +
            '✨ *Что я умею:*\n' +
            '• Создавать стикеры из фото\n' +
            '• Применять эффекты (винтаж, ЧБ, сепия, градиент, рамки, текст)\n' +
            '• Сохранять в избранное и подборки\n' +
            '• Показывать статистику и рейтинг\n' +
            '• Управлять своими стикерами и подборками\n\n' +
            '🎯 *Начните с кнопки ниже!*',
            MenuBuilder.getStartMenu()
          );
        }
        // 🎯 ГЛАВНОЕ МЕНЮ
        else if (text === '🚀 Начать создавать стикеры!' || text === '🔙 Назад') {
          await sendMainMenu(BOT_URL, chatId);
        }
        // ⚙️ УПРАВЛЕНИЕ
        else if (text === '⚙️ Управление') {
          await sendMessage(BOT_URL, chatId,
            '⚙️ *Управление стикерами и подборками*\n\n' +
            'Выберите действие:',
            MenuBuilder.getManagementMenu()
          );
        }
        // 📋 МОИ СТИКЕРЫ
        else if (text === '📋 Мои стикеры') {
          if (database) {
            const stickers = await database.getUserStickers(chatId);
            if (stickers.length === 0) {
              await sendMessage(BOT_URL, chatId,
                '📭 *У вас пока нет стикеров*\n\n' +
                'Создайте первый стикер с помощью кнопки "🎨 Создать стикер"',
                MenuBuilder.getMyStickersMenu(stickers)
              );
            } else {
              await sendMessage(BOT_URL, chatId,
                `📋 *Ваши стикеры* (${stickers.length})\n\n` +
                'Выберите стикер для просмотра или удаления:',
                MenuBuilder.getMyStickersMenu(stickers)
              );
            }
          } else {
            await sendMessage(BOT_URL, chatId,
              '📋 *Управление стикерами*\n\n' +
              'База данных временно недоступна',
              MenuBuilder.getMainMenu()
            );
          }
        }
        // 🗑️ УДАЛИТЬ СТИКЕР
        else if (text === '🗑️ Удалить стикер') {
          if (database) {
            const stickers = await database.getUserStickers(chatId);
            if (stickers.length === 0) {
              await sendMessage(BOT_URL, chatId,
                '📭 *Нет стикеров для удаления*\n\n' +
                'Сначала создайте стикеры',
                MenuBuilder.getMainMenu()
              );
            } else {
              userSessions[chatId] = { waitingFor: 'delete_sticker' };
              await sendMessage(BOT_URL, chatId,
                `🗑️ *Удаление стикеров*\n\n` +
                `Выберите стикер для удаления:\n\n` +
                stickers.map((s, i) => 
                  `${i + 1}. ${s.effect_applied === 'none' ? 'Без эффекта' : s.effect_applied}`
                ).join('\n'),
                MenuBuilder.getDeleteStickersMenu(stickers)
              );
            }
          }
        }
        // 🗂️ УПРАВЛЕНИЕ ПОДБОРКАМИ
        else if (text === '🗂️ Управление подборками') {
          if (database) {
            const collections = await database.getUserCollections(chatId);
            await sendMessage(BOT_URL, chatId,
              '🗂️ *Управление подборками*\n\n' +
              'Выберите действие:',
              MenuBuilder.getCollectionsManagementMenu(collections)
            );
          }
        }
        // 🗑️ УДАЛИТЬ ПОДБОРКУ
        else if (text === '🗑️ Удалить подборку') {
          if (database) {
            const collections = await database.getUserCollections(chatId);
            if (collections.length === 0) {
              await sendMessage(BOT_URL, chatId,
                '📭 *Нет подборок для удаления*\n\n' +
                'Сначала создайте подборки',
                MenuBuilder.getMainMenu()
              );
            } else {
              userSessions[chatId] = { waitingFor: 'delete_collection' };
              await sendMessage(BOT_URL, chatId,
                `🗑️ *Удаление подборок*\n\n` +
                `Выберите подборку для удаления:`,
                MenuBuilder.getDeleteCollectionsMenu(collections)
              );
            }
          }
        }
        // 🎨 СОЗДАТЬ СТИКЕР
        else if (text === '🎨 Создать стикер') {
          await sendMessage(BOT_URL, chatId,
            '📷 *Отправьте мне изображение!*\n\n' +
            '✅ *Поддерживаются:*\n' +
            '• Фотографии из Telegram\n' +
            '• PNG, JPG, JPEG файлы\n' +
            '• Размером до 20 МБ\n\n' +
            '📏 *Автоматически обрежется до 512x512*',
            MenuBuilder.removeMenu()
          );
        }
        // ⭐ ИЗБРАННОЕ
        else if (text === '⭐ Избранное') {
          await showFavoritesMenu(BOT_URL, chatId);
        }
        else if (text === '👀 Просмотреть избранное') {
          if (database) {
            const favorites = await database.getUserFavorites(chatId);
            if (favorites.length === 0) {
              await sendMessage(BOT_URL, chatId,
                '⭐ *Ваше избранное пусто*\n\n' +
                'Добавляйте стикеры в избранное с помощью кнопки "⭐" после создания стикера.',
                MenuBuilder.getFavoritesMenu()
              );
            } else {
              await sendMessage(BOT_URL, chatId,
                `⭐ *Ваши избранные стикеры* (${favorites.length}):\n\n` +
                favorites.map((f, i) => 
                  `${i + 1}. ${f.effect_applied === 'none' ? 'Без эффекта' : f.effect_applied}`
                ).join('\n'),
                MenuBuilder.getFavoritesMenu()
              );
            }
          } else {
            await sendMessage(BOT_URL, chatId,
              '⭐ *Ваше избранное*\n\n' +
              '_Здесь будут ваши любимые стикеры_\n\n' +
              '📌 *Как добавить:*\n' +
              'После создания стикера нажмите кнопку "⭐ В избранное"',
              MenuBuilder.getFavoritesMenu()
            );
          }
        }
        else if (text === '🗑️ Удалить из избранного') {
          await sendMessage(BOT_URL, chatId,
            '🗑️ *Удаление из избранного*\n\n' +
            'Используйте кнопку "🗑️" рядом с стикером в списке избранного',
            MenuBuilder.getFavoritesMenu()
          );
        }
        // 📚 ПОДБОРКИ
        else if (text === '📚 Мои подборки') {
          await showCollectionsMenu(BOT_URL, chatId);
        }
        else if (text === '📁 Создать первую подборку' || text === '➕ Новая подборка' || text === '➕ Создать подборку') {
          await sendMessage(BOT_URL, chatId,
            '📁 *Создание новой подборки*\n\n' +
            'Введите название для подборки:\n\n' +
            '💡 *Примеры:*\n' +
            '• "Мемы"\n' +
            '• "Природа"\n' +
            '• "Портреты"\n' +
            '• "Путешествия"',
            MenuBuilder.removeMenu()
          );
          userSessions[chatId] = { waitingFor: 'collection_name' };
        }
        // 🎭 ЭФФЕКТЫ
        else if (text === '🎭 Эффекты') {
          await showEffectsMenu(BOT_URL, chatId);
        }
        // 📊 СТАТИСТИКА
        else if (text === '📊 Статистика') {
          let statsMessage;
          
          if (database) {
            try {
              const stats = await database.getUserStats(chatId);
              const topUsers = await database.getTopUsers(50);
              
              let rank = '-';
              for (let i = 0; i < topUsers.length; i++) {
                if (topUsers[i].username === username) {
                  rank = `#${topUsers[i].rank}`;
                  break;
                }
              }
              
              statsMessage = `📊 *Статистика @${username}:*\n\n` +
                `🎨 Создано стикеров: *${stats.total_stickers || 0}*\n` +
                `⭐ Избранных: *${stats.favorites_count || 0}*\n` +
                `📚 Подборок: *${stats.collections_count || 0}*\n` +
                `🎭 Использовано эффектов: *${stats.effects_used || 0}*\n` +
                `🏆 Место в рейтинге: *${rank}*\n\n` +
                '_Данные из Neon PostgreSQL_ 🗄️';
            } catch (error) {
              statsMessage = `📊 *Статистика @${username}:*\n\n` +
                '🎨 Создано стикеров: *0*\n' +
                '⭐ Избранных: *0*\n' +
                '📚 Подборок: *0*\n' +
                '🎭 Использовано эффектов: *0*\n' +
                '🏆 Место в рейтинге: *-*\n\n' +
                '_База данных обновляется..._ 🔄';
            }
          } else {
            statsMessage = `📊 *Статистика @${username}:*\n\n` +
              '🎨 Создано стикеров: *0*\n' +
              '⭐ Избранных: *0*\n' +
              '📚 Подборок: *0*\n' +
              '🎭 Использовано эффектов: *0*\n' +
              '🏆 Место в рейтинге: *-*\n\n' +
              '_База данных скоро будет подключена_';
          }
          
          await sendMessage(BOT_URL, chatId, statsMessage, MenuBuilder.getMainMenu());
        }
        // 🏆 ТОП
        else if (text === '🏆 Топ') {
          let topMessage;
          
          if (database) {
            try {
              const topUsers = await database.getTopUsers(10);
              
              if (!topUsers || topUsers.length === 0) {
                topMessage = '🏆 *Топ создателей стикеров:*\n\n' +
                  '🥇 Пока никто не создал стикеров\n' +
                  '🥈 Будь первым!\n' +
                  '🥉 Отправь фото прямо сейчас!\n';
              } else {
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                topMessage = '🏆 *Топ создателей стикеров:*\n\n';
                
                topUsers.forEach((user, index) => {
                  const medal = medals[index] || '🔸';
                  const name = user.username ? `@${user.username}` : user.first_name || 'Аноним';
                  topMessage += `${medal} ${name} - ${user.stickers_created} стикеров\n`;
                });
              }
              topMessage += '\n_Данные из Neon PostgreSQL_ 🗄️';
            } catch (error) {
              topMessage = '🏆 *Топ создателей стикеров:*\n\n' +
                '🥇 Пока никто не создал стикеров\n' +
                '🥈 Будь первым!\n' +
                '🥉 Отправь фото прямо сейчас!\n\n' +
                '_База данных обновляется..._ 🔄';
            }
          } else {
            topMessage = '🏆 *Топ создателей стикеров:*\n\n' +
              '🥇 Пока никто не создал стикеров\n' +
              '🥈 Будь первым!\n' +
              '🥉 Отправь фото прямо сейчас!\n\n' +
              '_База данных скоро будет подключена_';
          }
          
          topMessage += '\n🎯 *Создай свой первый стикер!*';
          await sendMessage(BOT_URL, chatId, topMessage, MenuBuilder.getMainMenu());
        }
        // ℹ️ ПОМОЩЬ
        else if (text === 'ℹ️ Помощь' || text === '/help') {
          await sendMessage(BOT_URL, chatId,
            '📖 *Помощь по Sticker Bot:*\n\n' +
            '🎨 *Создание стикеров:*\n' +
            '1. Нажми "🎨 Создать стикер"\n' +
            '2. Отправь фото или изображение\n' +
            '3. Выбери эффект (если хочешь)\n' +
            '4. Получи готовый стикер!\n\n' +
            '⭐ *Избранное:*\n' +
            '• Добавляй кнопкой "⭐"\n' +
            '• Удаляй в меню избранного\n\n' +
            '📚 *Подборки:*\n' +
            '• Создавай тематические коллекции\n' +
            '• Добавляй стикеры в подборки\n' +
            '• Управляй в меню "⚙️ Управление"\n\n' +
            '🎭 *Эффекты:*\n' +
            'Винтаж, ЧБ, сепия, градиент, рамки, текст\n\n' +
            '⚙️ *Управление:*\n' +
            '• Просмотр своих стикеров\n' +
            '• Удаление стикеров и подборок\n\n' +
            '💎 *Полная версия!*',
            MenuBuilder.getMainMenu()
          );
        }
        // 📸 ОБРАБОТКА ФОТО
        else if (message.photo) {
          await handlePhoto(BOT_URL, chatId, message.photo, username, firstName);
        }
        // 📎 ОБРАБОТКА ДОКУМЕНТОВ
        else if (message.document && message.document.mime_type?.startsWith('image/')) {
          await handleDocument(BOT_URL, chatId, message.document, username, firstName);
        }
        // 🎭 ВЫБОР ЭФФЕКТА
        else if ([
          'винтаж', 'черно-белый', 'сепия', 'пикселизация', 'размытие',
          'градиент', 'перламутр', 'текст', 'золотая рамка', 
          'радужная рамка', 'инстаграм', 'без эффекта'
        ].includes(text.toLowerCase())) {
          await handleEffectSelection(BOT_URL, chatId, text, username, firstName);
        }
        // 📝 ОБРАБОТКА СПЕЦИАЛЬНЫХ КОМАНД УПРАВЛЕНИЯ
        else if (userSessions[chatId]) {
          const session = userSessions[chatId];
          
          if (session.waitingFor === 'collection_name') {
            // Создание подборки
            if (database) {
              const collection = await database.createCollection(chatId, text);
              if (collection) {
                await sendMessage(BOT_URL, chatId,
                  `✅ Подборка "*${text}*" создана!\n\n` +
                  'Теперь вы можете добавлять в неё стикеры.\n' +
                  'После создания стикера нажмите "📁 В подборку"',
                  MenuBuilder.getCollectionsMenu()
                );
              }
            } else {
              await sendMessage(BOT_URL, chatId,
                `✅ Подборка "${text}" создана!\n\n` +
                'Теперь вы можете добавлять в неё стикеры.\n' +
                'После создания стикера нажмите "📁 В подборку"',
                MenuBuilder.getCollectionsMenu([{ name: text, stickers_count: 0 }])
              );
            }
            delete userSessions[chatId];
          }
          else if (session.waitingFor === 'collection_for_sticker' && session.stickerId) {
            // Добавление стикера в подборку
            if (database) {
              const success = await database.addStickerToCollection(text, session.stickerId);
              if (success) {
                await sendMessage(BOT_URL, chatId,
                  `✅ Стикер добавлен в подборку "${text}"!`,
                  MenuBuilder.getMainMenu()
                );
              }
            }
            delete userSessions[chatId];
          }
          else if (session.waitingFor === 'delete_sticker') {
            // Удаление стикера по номеру
            const stickerIndex = parseInt(text);
            if (database && !isNaN(stickerIndex)) {
              const stickers = await database.getUserStickers(chatId);
              if (stickerIndex >= 1 && stickerIndex <= stickers.length) {
                const stickerId = stickers[stickerIndex - 1].id;
                const deleted = await database.deleteSticker(chatId, stickerId);
                if (deleted) {
                  await sendMessage(BOT_URL, chatId,
                    `🗑️ Стикер ${stickerIndex} удален!`,
                    MenuBuilder.getMainMenu()
                  );
                }
              }
            }
            delete userSessions[chatId];
          }
          else if (session.waitingFor === 'delete_collection') {
            // Удаление подборки по номеру
            const collectionIndex = parseInt(text);
            if (database && !isNaN(collectionIndex)) {
              const collections = await database.getUserCollections(chatId);
              if (collectionIndex >= 1 && collectionIndex <= collections.length) {
                const collectionId = collections[collectionIndex - 1].id;
                const deleted = await database.deleteCollection(chatId, collectionId);
                if (deleted) {
                  await sendMessage(BOT_URL, chatId,
                    `🗑️ Подборка ${collectionIndex} удалена!`,
                    MenuBuilder.getMainMenu()
                  );
                }
              }
            }
            delete userSessions[chatId];
          }
        }
        // 💬 ЛЮБОЙ ДРУГОЙ ТЕКСТ
        else if (text) {
          await sendMainMenu(BOT_URL, chatId);
        }
      }

      return res.status(200).json({ ok: true });

    } catch (error) {
      console.error('❌ Ошибка:', error);
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(404).json({ error: 'Not Found' });
};

// 🏠 ГЛАВНОЕ МЕНЮ
async function sendMainMenu(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '🎨 *Sticker Bot*\n\n' +
    'Выберите действие из меню ниже:',
    MenuBuilder.getMainMenu()
  );
}

// 🎭 МЕНЮ ЭФФЕКТОВ
async function showEffectsMenu(BOT_URL, chatId) {
  const effects = [
    { name: 'Без эффекта', is_premium: false, emoji: '🎨' },
    { name: 'Винтаж', is_premium: false, emoji: '🕰️' },
    { name: 'Черно-белый', is_premium: false, emoji: '⚫⚪' },
    { name: 'Сепия', is_premium: false, emoji: '🟤' },
    { name: 'Пикселизация', is_premium: false, emoji: '🎮' },
    { name: 'Размытие', is_premium: false, emoji: '🌀' },
    { name: 'Градиент', is_premium: true, emoji: '🌈' },
    { name: 'Перламутр', is_premium: true, emoji: '✨' },
    { name: 'Текст "Cool!"', is_premium: true, emoji: '📝' },
    { name: 'Золотая рамка', is_premium: true, emoji: '🖼️' },
    { name: 'Радужная рамка', is_premium: true, emoji: '🌈🖼️' },
    { name: 'Инстаграм фильтр', is_premium: true, emoji: '📸' }
  ];
  
  await sendMessage(BOT_URL, chatId,
    '🎭 *Эффекты для стикеров*\n\n' +
    'Выберите эффект для следующего стикера:\n' +
    effects.map(e => `• ${e.emoji || ''} ${e.name}${e.is_premium ? ' 💎' : ''}`).join('\n') +
    '\n\n💎 *Премиум эффекты доступны всем!*',
    MenuBuilder.getEffectsMenu(effects)
  );
}

// ⭐ МЕНЮ ИЗБРАННОГО
async function showFavoritesMenu(BOT_URL, chatId) {
  await sendMessage(BOT_URL, chatId,
    '⭐ *Ваше избранное*\n\n' +
    'Здесь хранятся ваши любимые стикеры:',
    MenuBuilder.getFavoritesMenu()
  );
}

// 📚 МЕНЮ ПОДБОРОК
async function showCollectionsMenu(BOT_URL, chatId) {
  let collections = [];
  if (database) {
    collections = await database.getUserCollections(chatId);
  }
  
  await sendMessage(BOT_URL, chatId,
    '📚 *Ваши подборки*\n\n' +
    'Создавайте тематические коллекции стикеров:',
    MenuBuilder.getCollectionsMenu(collections)
  );
}

// 🖼️ ОБРАБОТКА ФОТО
async function handlePhoto(BOT_URL, chatId, photos, username, firstName) {
  await sendMessage(BOT_URL, chatId, '🔄 *Скачиваю фото...*', MenuBuilder.removeMenu());
  
  const bestPhoto = photos[photos.length - 1];
  const fileId = bestPhoto.file_id;
  const fileUrl = await getFileUrl(BOT_URL, fileId);
  
  if (database) {
    try {
      await database.saveUser(chatId, username, firstName);
    } catch (error) {
      console.log('⚠️ Не удалось обновить пользователя:', error.message);
    }
  }
  
  userSessions[chatId] = {
    photoUrl: fileUrl,
    fileId: fileId,
    waitingFor: 'effect_selection'
  };
  
  await sendMessage(BOT_URL, chatId,
    '✅ *Фото получено!*\n\n' +
    '🎭 *Выберите эффект:*\n\n' +
    '✨ *Базовые:*\n' +
    '• Винтаж • ЧБ • Сепия\n\n' +
    '💎 *Премиум:*\n' +
    '• Градиент • Перламутр\n' +
    '• Текст • Золотая рамка\n' +
    '• Радужная рамка • Инстаграм\n\n' +
    '📝 *Напишите название эффекта*',
    MenuBuilder.removeMenu()
  );
  
  console.log(`📸 ${username} отправил фото: ${fileUrl}`);
}

// 📎 ОБРАБОТКА ДОКУМЕНТОВ
async function handleDocument(BOT_URL, chatId, document, username, firstName) {
  await sendMessage(BOT_URL, chatId, '🔄 *Загружаю изображение...*', MenuBuilder.removeMenu());
  
  const fileId = document.file_id;
  const fileUrl = await getFileUrl(BOT_URL, fileId);
  
  if (database) {
    try {
      await database.saveUser(chatId, username, firstName);
    } catch (error) {
      console.log('⚠️ Не удалось обновить пользователя:', error.message);
    }
  }
  
  userSessions[chatId] = {
    photoUrl: fileUrl,
    fileId: fileId,
    waitingFor: 'effect_selection'
  };
  
  await sendMessage(BOT_URL, chatId,
    '✅ *Изображение загружено!*\n\n' +
    '✨ *Выберите эффект:*\n' +
    '• Винтаж • ЧБ • Сепия\n' +
    '• Градиент • Перламутр\n' +
    '• Текст • Золотая рамка\n' +
    '• Радужная рамка • Инстаграм\n\n' +
    '📝 *Напишите название эффекта*',
    MenuBuilder.removeMenu()
  );
}

// 🎭 ВЫБОР ЭФФЕКТА И СОЗДАНИЕ СТИКЕРА
async function handleEffectSelection(BOT_URL, chatId, effectName, username, firstName) {
  const session = userSessions[chatId];
  
  if (!session || !session.photoUrl) {
    await sendMessage(BOT_URL, chatId, '❌ *Сначала отправьте фото!*', MenuBuilder.getMainMenu());
    return;
  }
  
  await sendMessage(BOT_URL, chatId, `🎭 *Создаю стикер с эффектом "${effectName}"...*`, MenuBuilder.removeMenu());
  
  try {
    const imageBuffer = await stickerCreator.downloadImage(session.photoUrl);
    
    const options = {};
    if (effectName.includes('Текст')) {
      options.text = 'Cool!';
      effectName = 'текст';
    } else if (effectName.includes('Золотая рамка')) {
      options.frameColor = 'gold';
      effectName = 'рамка';
    } else if (effectName.includes('Радужная рамка')) {
      options.frameColor = 'rainbow';
      effectName = 'рамка';
    } else if (effectName === 'Градиент') {
      options.gradientColor = 'rgba(255,105,180,0.3)';
    }
    
    const stickerResult = await stickerCreator.createSticker(imageBuffer, effectName, options);
    const stickerBuffer = stickerResult.buffer || stickerResult;
    
    const sendResult = await stickerCreator.sendSticker(process.env.TELEGRAM_BOT_TOKEN, chatId, stickerBuffer);
    
    let savedStickerId = null;
    if (database && session.fileId && sendResult.ok) {
      try {
        const effectMap = {
          'винтаж': 'vintage', 'черно-белый': 'grayscale', 'чб': 'grayscale',
          'сепия': 'sepia', 'пикселизация': 'pixelate', 'размытие': 'blur',
          'градиент': 'gradient', 'перламутр': 'pearl', 'текст': 'text',
          'золотая рамка': 'gold_frame', 'радужная рамка': 'rainbow_frame',
          'инстаграм': 'instagram', 'без эффекта': 'none'
        };
        
        const dbEffectName = effectMap[effectName.toLowerCase()] || 'none';
        const saved = await database.saveSticker(chatId, session.fileId, dbEffectName, stickerBuffer.length);
        if (saved && saved.id) {
          savedStickerId = saved.id;
        }
        console.log(`✅ Стикер сохранен в базу: ${dbEffectName}`);
      } catch (error) {
        console.log('⚠️ Не удалось сохранить стикер в базу:', error.message);
      }
    }
    
    const stickerId = savedStickerId || Date.now();
    let successMessage = `✅ *Стикер готов!*`;
    
    if (effectName !== 'без эффекта') {
      successMessage += ` Эффект: *${effectName}*`;
    }
    
    successMessage += `\n\n✨ *Что дальше?*`;
    
    await sendMessage(BOT_URL, chatId, successMessage, MenuBuilder.getStickerActions(stickerId));
    
    console.log(`🎨 Стикер создан для ${username}: ${effectName}`);
    delete userSessions[chatId];
    
  } catch (error) {
    console.error('❌ Ошибка создания:', error);
    await sendMessage(BOT_URL, chatId, 
      '❌ *Не удалось создать стикер*\nПопробуйте другое фото или эффект!',
      MenuBuilder.getMainMenu()
    );
  }
}

// 📤 ОТПРАВКА СООБЩЕНИЯ
async function sendMessage(BOT_URL, chatId, text, options = {}) {
  try {
    await fetch(`${BOT_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      })
    });
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.message);
  }
}

// 🔗 ПОЛУЧЕНИЕ URL ФАЙЛА
async function getFileUrl(BOT_URL, fileId) {
  try {
    const response = await fetch(`${BOT_URL}/getFile?file_id=${fileId}`);
    const data = await response.json();
    return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
  } catch (error) {
    console.error('❌ Ошибка получения файла:', error);
    return null;
  }
}

// 🔙 ОТВЕТ НА CALLBACK QUERY
async function answerCallbackQuery(BOT_URL, callbackId, text = '') {
  try {
    await fetch(`${BOT_URL}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text,
        show_alert: !!text
      })
    });
  } catch (error) {
    console.error('❌ Ошибка ответа на callback:', error.message);
  }
}
