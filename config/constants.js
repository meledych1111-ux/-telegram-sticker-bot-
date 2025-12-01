// Конфигурационные константы бота
module.exports = {
  // Размеры изображений
  IMAGE_SIZES: {
    STICKER: 512,
    PREVIEW: 200,
    THUMBNAIL: 100,
    MAX_FILE_SIZE: 10 * 1024 * 1024 // 10MB
  },
  
  // Эффекты
  EFFECTS: {
    NONE: 'none',
    GRAYSCALE: 'grayscale',
    SEPIA: 'sepia',
    INVERT: 'invert',
    BLUR: 'blur',
    SHARPEN: 'sharpen',
    PIXELATE: 'pixelate',
    VINTAGE: 'vintage',
    NEON: 'neon',
    GRADIENT: 'gradient',
    PEARL: 'pearl',
    GLOW: 'glow',
    SKETCH: 'sketch'
  },
  
  // Рамки
  FRAMES: {
    NONE: 'none',
    CIRCLE: 'circle',
    HEART: 'heart',
    STAR: 'star',
    ROUNDED: 'rounded',
    DIAMOND: 'diamond',
    HEXAGON: 'hexagon',
    CLOUD: 'cloud'
  },
  
  // Рейтинг
  RATING: {
    CREATE_STICKER: 10,
    RECEIVE_LIKE: 5,
    LOSE_DISLIKE: -2,
    DAILY_MIN: 5,
    DAILY_MAX: 15
  },
  
  // Текстовые позиции
  TEXT_POSITIONS: {
    TOP: 'top',
    CENTER: 'center',
    BOTTOM: 'bottom'
  },
  
  // Кэширование
  CACHE: {
    TTL: 300, // 5 минут
    CHECK_PERIOD: 60 // 1 минута
  },
  
  // Сессии
  SESSION: {
    TTL: 1800, // 30 минут
    CLEANUP_INTERVAL: 600 // 10 минут
  },
  
  // Лимиты
  LIMITS: {
    TEXT_LENGTH: 50,
    STICKERS_PER_USER: 1000,
    VOTES_PER_USER: 10000
  },
  
  // Пагинация
  PAGINATION: {
    TOP_STICKERS: 10,
    TOP_USERS: 10,
    TRENDING: 10
  },
  
  // Сообщения
  MESSAGES: {
    WELCOME: `🎨 *Добро пожаловать в Sticker Bot!*\n\nСоздавай уникальные стикеры с эффектами, рамками и текстом. Зарабатывай рейтинг и соревнуйся с другими!`,
    HELP: `📚 *Помощь по командам*\n\n` +
          `*Основные команды:*\n` +
          `/start - Начать работу\n` +
          `/help - Эта справка\n` +
          `/create - Создать стикер\n` +
          `/profile - Мой профиль\n` +
          `/top - Топ стикеров\n` +
          `/rating - Рейтинг игроков\n` +
          `/trending - Тренды\n\n` +
          `*Эффекты:* неон, градиент, перламутр, винтаж и др.\n` +
          `*Рамки:* сердце, звезда, круг, облако и др.\n` +
          `*Текст:* добавляй любой текст на стикер`
  }
};
