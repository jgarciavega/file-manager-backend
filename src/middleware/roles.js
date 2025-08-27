const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware para cargar roles del usuario (espera req.user.id si está autenticado)
async function loadUserRoles(req, res, next) {
  try {
    if (!req.user || !req.user.id) return next();
    if (req.user.roles && Array.isArray(req.user.roles)) return next();

    const usuario = await prisma.usuarios.findUnique({
      where: { id: req.user.id },
      include: { roles: { include: { role: true } } }
    });

    if (usuario && usuario.roles) {
      req.user.roles = usuario.roles.map((ur) => ur.role.name);
    } else {
      req.user.roles = [];
    }
  } catch (e) {
    console.error('Error cargando roles de usuario:', e);
    req.user = req.user || {};
    req.user.roles = [];
  }
  return next();
}

const requireRole = (roleName) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'No autenticado' });
    const roles = user.roles || [];
    if (roles.includes(roleName)) return next();
    return res.status(403).json({ success: false, message: 'Permiso denegado' });
  };
};

const requireAnyRole = (...allowed) => {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'No autenticado' });
    const roles = user.roles || [];
    if (allowed.some((r) => roles.includes(r))) return next();
    return res.status(403).json({ success: false, message: 'Permiso denegado' });
  };
};

module.exports = { loadUserRoles, requireRole, requireAnyRole };
