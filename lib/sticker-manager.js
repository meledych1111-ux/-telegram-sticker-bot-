const axios = require('axios');
const FormData = require('form-data');
const db = require('./database');
const imageProcessor = require('./image-processor');
const cache = require('./cache');
const config = require('../config/constants');

class StickerManager {
  constructor(botToken) {
    this.botToken = botToken;
    this.telegramApi = `https://api.telegram.org/bot${botToken}`;
  }
  
  // Отправка стикера в Telegram
  async sendSticker(chatId, stickerBuffer, options = {}) {
    try {
      const formData = new FormData();
      
      // Добавляем файл
      formData.append('sticker', stickerBuffer, {
        filename: `sticker_${Date.now()}.png`,
        contentType: 'image/png'
      });
      
      // Добавляем остальные параметры
      formData.append('chat_id', chatId);
      
      if (options.reply_markup) {
        formData.append('reply_markup', JSON.stringify(options.reply_markup));
      }
      
      if (options.reply_to_message_id) {
        formData.append('reply_to_message_id', options.reply_to_message_id);
      }
      
      // Отправляем запрос к Telegram API
      const response = await axios.post(
        `${this.telegramApi}/sendSticker`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Length': formData.getLengthSync()
          },
          timeout: 10000
        }
      );
      
      return response.data.result;
    } catch (error) {
      console.error('Error sending sticker:', error.response?.data || error.message);
      
      // Если не удалось отправить как стикер, отправляем как фото
      if (error.response?.data?.description?.includes('STICKER')) {
        return await this.sendPhoto(chatId, stickerBuffer, options);
      }
      
      throw error;
    }
  }
  
  // Отправка фото (fallback)
  async sendPhoto(chatId, imageBuffer, options = {}) {
    try {
      const formData = new FormData();
      
      formData.append('photo', imageBuffer, {
        filename: `photo_${Date.now()}.png`,
        contentType: 'image/png'
      });
      
      formData.append('chat_id', chatId);
      
      if (options.caption) {
        formData.append('caption', options.caption);
        formData.append('parse_mode', 'Markdown');
      }
      
      if (options.reply_markup) {
        formData.append('reply_markup', JSON.stringify(options.reply_markup));
      }
      
      const response = await axios.post(
        `${this.telegramApi}/sendPhoto`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Length': formData.getLengthSync()
          },
          timeout: 10000
        }
      );
      
      return response.data.result;
    } catch (error) {
      console.error('Error sending photo:', error.response?.data || error.message);
      throw error;
    }
  }
  
  // Получение информации о файле
  async getFile(fileId) {
    try {
      const response = await axios.get(`${this.telegramApi}/getFile`, {
        params: { file_id: fileId },
        timeout: 5000
      });
      
      return response.data.result;
    } catch (error) {
      console.error('Error getting file:', error.message);
      throw error;
    }
  }
  
  // Получение прямой ссылки на файл
  async getFileUrl(fileId) {
    const file = await this.getFile(fileId);
    return `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
  }
  
  // Создание стикера из фото
  async createStickerFromPhoto(userId, fileId, options = {}) {
    try {
      // Получаем URL фото
      const fileUrl = await this.getFileUrl(fileId);
      
      // Скачиваем изображение
      const imageBuffer = await imageProcessor.downloadImage(fileUrl);
      
      // Создаем стикер
      const stickerBuffer = await imageProcessor.createSticker(imageBuffer, {
        effect: options.effect || config.EFFECTS.NONE,
        frame: options.frame || config.FRAMES.NONE,
        text: options.text,
        textPosition: options.textPosition || config.TEXT_POSITIONS.BOTTOM
      });
      
      return {
        success: true,
        buffer: stickerBuffer,
        metadata: {
          effect: options.effect,
          frame: options.frame,
          hasText: !!options.text,
          text: options.text
        }
      };
    } catch (error) {
      console.error('Error creating sticker from photo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Создание и сохранение стикера
  async processAndSaveSticker(userId, fileId, options = {}) {
    const startTime = Date.now();
    
    try {
      // Создаем стикер
      const result = await this.createStickerFromPhoto(userId, fileId, options);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error,
          processingTime: Date.now() - startTime
        };
      }
      
      // Отправляем стикер
      const stickerMessage = await this.sendSticker(userId, result.buffer);
      
      // Сохраняем в базу данных
      const savedSticker = await db.saveSticker({
        userId: userId,
        fileId: stickerMessage.sticker.file_id,
        fileUniqueId: stickerMessage.sticker.file_unique_id,
        effect: options.effect || config.EFFECTS.NONE,
        frame: options.frame || config.FRAMES.NONE,
        text: options.text,
        tags: [options.effect, options.frame].filter(Boolean)
      });
      
      // Обновляем рейтинг пользователя
      await db.updateUserRating(userId, config.RATING.CREATE_STICKER);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        sticker: savedSticker,
        message: stickerMessage,
        processingTime: processingTime,
        fileId: stickerMessage.sticker.file_id
      };
    } catch (error) {
      console.error('Error in processAndSaveSticker:', error);
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  // Добавление голоса к стикеру
  async addVoteToSticker(userId, stickerFileId, voteType) {
    try {
      // Находим стикер в базе
      const sticker = await db.getSticker(stickerFileId);
      
      if (!sticker) {
        return {
          success: false,
          error: 'Стикер не найден'
        };
      }
      
      // Добавляем голос
      const voteSuccess = await db.addVote(userId, sticker.id, voteType);
      
      if (!voteSuccess) {
        return {
          success: false,
          error: 'Не удалось добавить голос'
        };
      }
      
      // Получаем обновленный стикер
      const updatedSticker = await db.getSticker(stickerFileId);
      
      return {
        success: true,
        sticker: updatedSticker,
        voteType: voteType
      };
    } catch (error) {
      console.error('Error adding vote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Получение статистики по стикерам пользователя
  async getUserStickers(userId, limit = 20) {
    try {
      const result = await db.pool.query(`
        SELECT * FROM stickers 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [userId, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting user stickers:', error);
      return [];
    }
  }
  
  // Получение популярных стикеров
  async getPopularStickers(category = 'all', limit = 10) {
    try {
      let query = `
        SELECT s.*, u.username, u.first_name,
               (s.likes * 100.0 / NULLIF(s.views, 0)) as engagement_rate
        FROM stickers s
        JOIN users u ON s.user_id = u.user_id
      `;
      
      const params = [limit];
      
      if (category !== 'all') {
        query += ` WHERE s.tags @> ARRAY[$2]::varchar[]`;
        params.push(category);
      }
      
      query += ` ORDER BY engagement_rate DESC, s.created_at DESC LIMIT $1`;
      
      const result = await db.pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting popular stickers:', error);
      return [];
    }
  }
  
  // Обновление просмотров стикера
  async incrementStickerViews(fileId) {
    try {
      await db.incrementStickerViews(fileId);
      return true;
    } catch (error) {
      console.error('Error incrementing sticker views:', error);
      return false;
    }
  }
  
  // Генерация уникального тега для стикера
  generateStickerTag(effect, frame, hasText) {
    const tags = [];
    
    if (effect && effect !== config.EFFECTS.NONE) {
      tags.push(`effect:${effect}`);
    }
    
    if (frame && frame !== config.FRAMES.NONE) {
      tags.push(`frame:${frame}`);
    }
    
    if (hasText) {
      tags.push('has:text');
    }
    
    return tags;
  }
  
  // Получение информации о стикере для отображения
  async getStickerInfo(fileId) {
    const sticker = await db.getSticker(fileId);
    
    if (!sticker) {
      return null;
    }
    
    const user = await db.getUser(sticker.user_id);
    
    return {
      id: sticker.id,
      fileId: sticker.file_id,
      effect: sticker.effect,
      frame: sticker.frame,
      hasText: sticker.has_text,
      text: sticker.text_content,
      likes: sticker.likes,
      views: sticker.views,
      created: sticker.created_at,
      author: {
        id: user?.user_id,
        username: user?.username,
        firstName: user?.first_name,
        rating: user?.rating
      },
      engagement: sticker.likes > 0 ? 
        (sticker.likes * 100 / Math.max(sticker.views, 1)) : 0
    };
  }
}

module.exports = StickerManager;
