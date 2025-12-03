// 🏆 ТОП (с отладкой)
else if (text === '🏆 Топ') {
  // 📌 ПОЛУЧАЕМ ТОП ИЗ БАЗЫ ДАННЫХ
  let topMessage;
  
  if (database) {
    try {
      console.log('🔍 Запрашиваю топ пользователей...');
      const topUsers = await database.getTopUsers(10);
      console.log('📊 Получен топ:', topUsers);
      
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
          const stickersCount = user.stickers_created || 0;
          topMessage += `${medal} ${name} - ${stickersCount} стикеров\n`;
        });
      }
      topMessage += '\n_Данные из Neon PostgreSQL_ 🗄️';
    } catch (error) {
      console.log('❌ Ошибка получения топа:', error.message, error.stack);
      topMessage = '🏆 *Топ создателей стикеров:*\n\n' +
        '🥇 Пока никто не создал стикеров\n' +
        '🥈 Будь первым!\n' +
