const axios = require('axios');
require('dotenv').config();

async function main() {
  const token = process.env.BOT_TOKEN;
  const url = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}/api/bot`
    : process.env.WEBHOOK_URL;
  
  if (!token) {
    console.log('❌ Add BOT_TOKEN to .env file');
    return;
  }
  
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${token}/setWebhook`,
      { params: { url } }
    );
    
    console.log(response.data.ok ? '✅ Webhook set' : '❌ Failed');
    console.log('URL:', url);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
