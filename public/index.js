<!DOCTYPE html>
<html>
<head>
    <title>Sticker Bot Status</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 50px 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            font-size: 3em;
            margin-bottom: 20px;
            background: linear-gradient(45deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-size: 300% 300%;
            animation: gradient 3s ease infinite;
        }
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .status {
            background: rgba(255,255,255,0.2);
            border-radius: 15px;
            padding: 20px;
            margin: 20px 0;
            font-size: 1.2em;
        }
        .badge {
            display: inline-block;
            background: rgba(255,255,255,0.3);
            padding: 5px 15px;
            border-radius: 20px;
            margin: 5px;
            font-weight: bold;
        }
        .tech {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 30px;
        }
        a {
            color: #48dbfb;
            text-decoration: none;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Sticker Bot</h1>
        <p>Создавай стикеры с эффектами прямо в Telegram!</p>
        
        <div class="status">
            ✅ <strong>Статус:</strong> Бот работает<br>
            🕒 <strong>Время:</strong> <span id="time">Загрузка...</span><br>
            🚀 <strong>Платформа:</strong> Vercel + Neon
        </div>
        
        <p>
            <a href="https://t.me/your_bot_username" target="_blank">
                ▶️ Начать пользоваться ботом
            </a>
        </p>
        
        <div class="tech">
            <span class="badge">Node.js 20</span>
            <span class="badge">Vercel</span>
            <span class="badge">Neon PostgreSQL</span>
            <span class="badge">Telegram Bot API</span>
            <span class="badge">Sharp</span>
        </div>
        
        <p style="margin-top: 30px; font-size: 0.9em; opacity: 0.8;">
            🔧 Полностью бесплатный хостинг<br>
            ⚡ Быстрая обработка изображений<br>
            🏆 Рейтинговая система
        </p>
    </div>
    
    <script>
        function updateTime() {
            const now = new Date();
            document.getElementById('time').textContent = 
                now.toLocaleTimeString('ru-RU') + ' (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')';
        }
        updateTime();
        setInterval(updateTime, 1000);
    </script>
</body>
</html>
