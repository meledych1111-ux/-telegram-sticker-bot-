import winston from 'winston';

// Конфигурация логгера
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
      
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      
      return log;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Создаем функции логгирования
export function info(message, meta) {
  logger.info(message, meta);
}

export function error(message, meta) {
  logger.error(message, meta);
}

export function warn(message, meta) {
  logger.warn(message, meta);
}

export function debug(message, meta) {
  logger.debug(message, meta);
}

// Экспортируем сам логгер тоже
export default logger;
