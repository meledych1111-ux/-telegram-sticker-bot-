// Вспомогательные утилиты

module.exports = {
  // Форматирование даты
  formatDate: (date) => {
    if (!date) return 'Неизвестно';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Форматирование времени (сколько прошло)
  formatTimeAgo: (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return this.formatDate(date);
  },

  // Валидация текста для стикера
  validateText: (text) => {
    if (!text || text.trim().length === 0) {
      return { valid: false, error: 'Текст не может быть пустым' };
    }
    if (text.length > 100) {
      return { valid: false, error: 'Текст слишком длинный (макс. 100 символов)' };
    }
    if (/[<>]/g.test(text)) {
      return { valid: false, error: 'Текст содержит недопустимые символы' };
    }
    return { valid: true, error: null };
  },

  // Валидация имени папки
  validateFolderName: (name) => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Название папки не может быть пустым' };
    }
    if (name.length > 50) {
      return { valid: false, error: 'Название слишком длинное (макс. 50 символов)' };
    }
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(name)) {
      return { valid: false, error: 'Название содержит недопустимые символы' };
    }
    return { valid: true, error: null };
  },

  // Генерация случайного цвета
  generateRandomColor: () => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
      '#EF476F', '#7209B7', '#3A86FF', '#FB5607', '#8338EC'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  // Обрезка текста с многоточием
  truncateText: (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  // Проверка MIME типа
  isValidImageType: (mimeType) => {
    const validTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    return validTypes.includes(mimeType);
  },

  // Получение расширения файла
  getFileExtension: (filename) => {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  },

  // Форматирование размера файла
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Создание уникального ID
  generateId: (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Экранирование HTML
  escapeHtml: (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // Проверка является ли строка URL
  isValidUrl: (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },

  // Пауза выполнения
  sleep: (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Генерация градиента для эффектов
  generateGradient: (width, height, colors = ['#FF6B6B', '#4ECDC4']) => {
    // Простой градиент для эффектов
    return {
      startColor: colors[0],
      endColor: colors[1],
      angle: 45 // градусы
    };
  }
};
