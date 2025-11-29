// api/stats.js
const db = require('../lib/database');

module.exports = async (req, res) => {
  try {
    await db.init?.();
    const count = await db.getUserCount();
    const top = await db.getTopUsers(10);
    return res.status(200).json({ users: +count, top });
  } catch (e) {
    console.error('stats error', e?.message || e);
    return res.status(500).json({ error: 'internal' });
  }
};
