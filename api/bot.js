// Добавьте этот код в api/bot.js
app.get('/api/setup-webhook', (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const vercelUrl = process.env.VERCEL_URL;
  
  if (!token || !vercelUrl) {
    return res.json({
      error: 'Missing environment variables',
      hasToken: !!token,
      hasUrl: !!vercelUrl,
      instructions: 'Add TELEGRAM_BOT_TOKEN and ensure VERCEL_URL is set'
    });
  }
  
  const webhookUrl = `${vercelUrl}/api/bot`;
  const setupUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;
  
  res.json({
    status: 'Webhook setup instructions',
    bot_token_preview: `${token.substring(0, 10)}...${token.substring(token.length - 5)}`,
    vercel_url: vercelUrl,
    webhook_url: webhookUrl,
    setup_url: setupUrl,
    instructions: [
      '1. Click the setup_url link below',
      '2. You should see {"ok":true,"result":true,"description":"Webhook was set"}',
      '3. Test your bot in Telegram with /start',
      '',
      `📎 Direct link: ${setupUrl}`
    ]
  });
});
