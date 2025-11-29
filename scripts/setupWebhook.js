// 🔗  scripts/setupWebhook.js – установка / проверка / удаление webhook
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const VERCEL_URL = process.env.VERCEL_URL;

if (!BOT_TOKEN || !VERCEL_URL) {
  console.error('❌  Установите BOT_TOKEN и VERCEL_URL в Vercel → Settings → Environment Variables');
  process.exit(1);
}

const webhookUrl = `${VERCEL_URL}/api/bot`;

async function setup() {
  console.log('⚙️  Устанавливаю вебхук...');
  const { data } = await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    { url: webhookUrl, max_connections: 40, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }
  );
  if (data.ok) console.log('✅  Вебхук установлен:', webhookUrl);
  else console.error('❌ ', data.description);
}

async function status() {
  const { data } = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  console.log('📊  Статус:', data.result);
}

async function remove() {
  const { data } = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
  console.log(data.ok ? '✅  Вебхук удалён' : '❌ ', data.description);
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'status') status();
  else if (cmd === 'delete') remove();
  else setup();
}

module.exports = { setup, status, remove };
