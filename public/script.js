document.addEventListener('DOMContentLoaded', function() {
    const statusIndicator = document.getElementById('statusIndicator');
    const dbStatus = document.getElementById('dbStatus');
    const totalUsers = document.getElementById('totalUsers');
    const totalStickers = document.getElementById('totalStickers');
    const cacheHitRate = document.getElementById('cacheHitRate');
    
    // Функция обновления статуса
    async function updateStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            // Обновляем статус индикатор
            const dot = statusIndicator.querySelector('.dot');
            if (data.status === 'ok') {
                dot.style.background = '#4ade80'; // Зеленый
                statusIndicator.innerHTML = '<span class="dot"></span><span>🟢 Система работает</span>';
            } else {
                dot.style.background = '#f87171'; // Красный
                statusIndicator.innerHTML = '<span class="dot"></span><span>🔴 Проблемы с системой</span>';
            }
            
            // Обновляем статистику
            if (data.database.status === 'connected') {
                dbStatus.textContent = '✅';
                dbStatus.title = 'База данных подключена';
            } else {
                dbStatus.textContent = '❌';
                dbStatus.title = 'База данных отключена';
            }
            
            if (data.statistics && data.statistics.total_users) {
                totalUsers.textContent = data.statistics.total_users.toLocaleString();
                totalUsers.title = `Всего пользователей: ${data.statistics.total_users}`;
            }
            
            if (data.statistics && data.statistics.total_stickers) {
                totalStickers.textContent = data.statistics.total_stickers.toLocaleString();
                totalStickers.title = `Всего стикеров: ${data.statistics.total_stickers}`;
            }
            
            if (data.cache && data.cache.hitRate) {
                const hitRate = Math.round(data.cache.hitRate * 100);
                cacheHitRate.textContent = `${hitRate}%`;
                cacheHitRate.title = `Эффективность кэша: ${hitRate}%`;
            }
            
        } catch (error) {
            console.error('Failed to fetch status:', error);
            
            // Показываем ошибку
            statusIndicator.innerHTML = '<span class="dot" style="background: #f87171;"></span><span>🔴 Ошибка подключения</span>';
            dbStatus.textContent = '❌';
            dbStatus.title = 'Не удалось подключиться';
        }
    }
    
    // Обновляем статус сразу и каждые 30 секунд
    updateStatus();
    setInterval(updateStatus, 30000);
    
    // Анимация для карточек
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
    
    // Анимация для кнопок
    const buttons = document.querySelectorAll('.btn, .feature, .tech-icon');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Обновление времени в футере
    function updateDateTime() {
        const now = new Date();
        const dateTimeString = now.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
        
        // Добавляем время в футер, если его там нет
        let timeElement = document.querySelector('.time-display');
        if (!timeElement) {
            timeElement = document.createElement('div');
            timeElement.className = 'time-display';
            timeElement.style.marginTop = '10px';
            timeElement.style.fontSize = '0.9em';
            timeElement.style.opacity = '0.7';
            document.querySelector('footer').appendChild(timeElement);
        }
        
        timeElement.textContent = `Время сервера: ${dateTimeString}`;
    }
    
    // Обновляем время каждую секунду
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Добавляем анимацию загрузки для статистики
    const statValues = document.querySelectorAll('.stat-value');
    statValues.forEach(value => {
        if (value.textContent === '—') {
            value.innerHTML = '<span class="loading">⏳</span>';
        }
    });
});
