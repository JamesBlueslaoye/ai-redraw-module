function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
  }
  next();
}

module.exports = { requireAuth };
