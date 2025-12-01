module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  
  const memory = process.memoryUsage();
  
  res.status(200).json({
    status: '🟢 Online',
    service: 'Sticker Bot',
    version: '2.1.0',
    environment: process.env.NODE_ENV || 'production',
    memory: {
      used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
    },
    uptime: Math.floor(process.uptime()) + 's',
    region: process.env.VERCEL_REGION || 'unknown',
    timestamp: new Date().toISOString()
  });
};
