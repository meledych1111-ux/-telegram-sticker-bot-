// Отдельный endpoint для управления вебхуком
const TelegramBot = require('node-telegram-bot-api');

module.exports = async (req, res) => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const VERCEL_URL = process.env.VERCEL_URL || 'https://your-project.vercel.app';
  const WEBHOOK_URL = `${VERCEL_URL}/api/bot`;
  
  if (!BOT_TOKEN) {
    return res.status(500).json({
      error: 'TELEGRAM_BOT_TOKEN не настроен'
    });
  }
  
  const bot = new TelegramBot(BOT_TOKEN);
  const action = req.query.action || 'setup';
  
  try {
    if (action === 'setup') {
      // Установка вебхука
      const result = await bot.setWebHook(WEBHOOK_URL);
      
      const botInfo = await bot.getMe();
      
      return res.json({
        success: true,
        action: 'webhook_setup',
        result: result,
        bot: {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name
        },
        webhook: {
          url: WEBHOOK_URL,
          domain: VERCEL_URL
        },
        timestamp: new Date().toISOString()
      });
      
    } else if (action === 'info') {
      // Информация о вебхуке
      const webhookInfo = await bot.getWebHookInfo();
      
      return res.json({
        success: true,
        action: 'webhook_info',
        info: webhookInfo,
        bot_info: await bot.getMe(),
        system: {
          node: process.version,
          timestamp: new Date().toISOString()
        }
      });
      
    } else if (action === 'delete') {
      // Удаление вебхука
      const result = await bot.deleteWebHook();
      
      return res.json({
        success: true,
        action: 'webhook_delete',
        result: result,
        message: 'Webhook удален'
      });
      
    } else {
      return res.status(400).json({
        error: 'Неизвестное действие',
        available_actions: ['setup', 'info', 'delete']
      });
    }
    
  } catch (error) {
    console.error('Webhook management error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      action: action,
      timestamp: new Date().toISOString()
    });
  }
};
