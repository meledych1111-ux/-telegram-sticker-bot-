const axios = require('axios');

async function setupWebhook() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const VERCEL_URL = process.env.VERCEL_URL;

  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required');
    process.exit(1);
  }

  if (!VERCEL_URL) {
    console.error('❌ VERCEL_URL is required');
    process.exit(1);
  }

  const webhookUrl = `${VERCEL_URL}/api/bot`;

  try {
    console.log('🔄 Setting up webhook...');
    
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        url: webhookUrl,
        max_connections: 40,
        allowed_updates: ['message']
      }
    );

    if (response.data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`📝 Webhook URL: ${webhookUrl}`);
    } else {
      console.error('❌ Failed to set webhook:', response.data.description);
    }

  } catch (error) {
    console.error('❌ Error setting webhook:', error.response?.data || error.message);
  }
}

// Автозапуск при прямом вызове
if (require.main === module) {
  setupWebhook();
}

module.exports = setupWebhook;
