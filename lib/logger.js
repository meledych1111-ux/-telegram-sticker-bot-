const winston = require('winston');
const path = require('path');

// Определяем уровень логирования
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Формат логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Создаем логгер
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'telegram-sticker-bot' },
  transports: [
    // Console transport (всегда включен)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => {
          const { timestamp, level, message, ...meta } = info;
          let log = `${timestamp} [${level}]: ${message}`;
          
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta, null, 2)}`;
          }
          
          return log;
        })
      )
    })
  ]
});

// В продакшене добавляем файловый транспорт
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs/error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
  
  logger.add(new winston.transports.File({
    filename: path.join(process.cwd(), 'logs/combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

// Middleware для Express
logger.expressMiddleware = function(req, res, next) {
  const start = Date.now();
  
  // Логируем запрос
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Логируем ответ
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
  });
  
  next();
};

// Утилиты для логирования
logger.botEvent = function(event, data) {
  logger.info(`Bot event: ${event}`, data);
};

logger.dbQuery = function(query, params, duration) {
  logger.debug('Database query', {
    query: query.substring(0, 100) + '...',
    params: params,
    duration: `${duration}ms`
  });
};

logger.imageProcessing = function(action, details) {
  logger.info(`Image processing: ${action}`, details);
};

logger.errorHandler = function(error, context = {}) {
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    ...context
  });
};

module.exports = logger;
