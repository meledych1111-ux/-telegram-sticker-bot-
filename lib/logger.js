// Простая система логирования для Vercel

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function shouldLog(level) {
  return logLevels[level] <= logLevels[currentLogLevel];
}

function formatMessage(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (args.length > 0) {
    const extra = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    return `${prefix}: ${message} ${extra}`;
  }
  
  return `${prefix}: ${message}`;
}

const logger = {
  error: (message, ...args) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, ...args));
    }
  },
  
  warn: (message, ...args) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, ...args));
    }
  },
  
  info: (message, ...args) => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, ...args));
    }
  },
  
  debug: (message, ...args) => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, ...args));
    }
  },
  
  // Специальные логи для бота
  botEvent: (event, data) => {
    logger.info(`Bot Event: ${event}`, data);
  },
  
  dbQuery: (query, params, duration) => {
    logger.debug(`DB Query (${duration}ms):`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params_count: params?.length || 0
    });
  },
  
  imageProcessing: (action, details) => {
    logger.info(`Image Processing: ${action}`, details);
  },
  
  webhook: (updateId, processingTime) => {
    logger.debug(`Webhook processed: update=${updateId}, time=${processingTime}ms`);
  }
};

module.exports = logger;
