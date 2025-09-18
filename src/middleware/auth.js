const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return res.status(401).json({ ok: false, message: 'Authorization header missing' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ ok: false, message: 'Authorization format must be: Bearer <token>' });

  const token = parts[1];
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ ok: false, message: 'JWT_SECRET not configured on server' });
    const payload = jwt.verify(token, secret);
    // adjuntar información útil
    req.userId = payload.id || payload.userId || null;
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado', error: err.message });
  }
};

module.exports = { verifyToken };
