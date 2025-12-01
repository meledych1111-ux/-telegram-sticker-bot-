import { info, error } from './logger.js';

/**
 * Форматирование размера файла
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Генерация случайной строки
 */
export function generateRandomString(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Валидация Telegram ID
 */
export function isValidTelegramId(id) {
  return Number.isInteger(id) && id > 0;
}

/**
 * Обработка ошибок с логированием
 */
export function handleError(err, context = '') {
  const errorMessage = `${context}: ${err.message}`;
  error(errorMessage);
  
  return {
    success: false,
    error: err.message,
    context,
    timestamp: new Date().toISOString()
  };
}

/**
 * Задержка выполнения
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Проверка токена бота
 */
export function validateBotToken(token) {
  const tokenRegex = /^\d{9,11}:[A-Za-z0-9_-]{35}$/;
  return tokenRegex.test(token);
}

// Именованные экспорты
export default {
  formatFileSize,
  generateRandomString,
  isValidTelegramId,
  handleError,
  delay,
  validateBotToken
};
