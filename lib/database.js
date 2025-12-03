// 🎨 Сохранить информацию о стикере (ОБНОВЛЕННАЯ)
async function saveSticker(chatId, fileId, effect = 'none', sizeBytes = 0) {
  try {
    await initializeTables();
    
    const user = await sql`
      SELECT id FROM users WHERE chat_id = ${chatId}
    `;
    
    if (user.length > 0) {
      await sql`
        INSERT INTO stickers (user_id, original_format, sticker_size, processing_time, effect_applied, file_id)
        VALUES (${user[0].id}, 'photo', ${sizeBytes}, 0, ${effect}, ${fileId})
      `;
      
      // Увеличиваем счетчик стикеров у пользователя
      await sql`
        UPDATE users 
        SET stickers_created = stickers_created + 1 
        WHERE id = ${user[0].id}
      `;
      
      console.log(`✅ Стикер сохранен с эффектом: ${effect}, file_id: ${fileId}`);
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения стикера:', error);
  }
}
