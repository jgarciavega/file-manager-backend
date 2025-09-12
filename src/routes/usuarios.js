const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// GET /api/usuarios - Obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, activo } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (activo !== undefined) where.activo = parseInt(activo);

  const includeRoles = req.query.includeRoles === '1' || req.query.includeRoles === 'true';

    const usuarios = await prisma.usuarios.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        activo: true,
        documentos: {
          select: { id: true, nombre: true, fecha_subida: true }
        },
  ...(includeRoles && { role: true })
      }
    });

    const total = await prisma.usuarios.count({ where });

    return successResponse(res, {
      usuarios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al obtener usuarios', 500, error.message);
  }
});

// GET /api/usuarios/:id - Obtener usuario por ID
// GET /api/usuarios/view - Vista enriquecida: usuarios con roles, conteo de documentos y última acción
router.get('/view', async (req, res) => {
  try {
    const { page = 1, limit = 20, role, activo } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (activo !== undefined) where.activo = parseInt(activo);

    // Si se filtra por role, buscar usuarios por role.tipo (campo en roles)
    if (role) {
      const roleObj = await prisma.roles.findFirst({ where: { tipo: role } });
      if (!roleObj) {
        return successResponse(res, { usuarios: [], pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 } });
      }
      where.role_id = roleObj.id;
    }

    const usuarios = await prisma.usuarios.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        activo: true,
      }
    });

    const total = await prisma.usuarios.count({ where });

    // enriquecer
    const enriched = await Promise.all(usuarios.map(async (u) => {
  const usuarioFull = await prisma.usuarios.findUnique({ where: { id: u.id }, include: { role: true } });
  const roles = usuarioFull.role ? [usuarioFull.role.tipo] : [];

      const docsCount = await prisma.documentos.count({ where: { usuarios_id: u.id } });

      const lastAct = await prisma.bitacora.findFirst({ where: { usuario_id: u.id }, orderBy: { fecha_inicio: 'desc' } });

      return {
        ...u,
        roles,
        documentCount: docsCount,
        lastAction: lastAct ? { accion: lastAct.accion, fecha_inicio: lastAct.fecha_inicio, descripcion: lastAct.descripcion } : null
      };
    }));

    return successResponse(res, {
      usuarios: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al obtener vista de usuarios', 500, error.message);
  }
});

// GET /api/usuarios/:id - Obtener usuario por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const idNum = id !== undefined ? parseInt(id, 10) : NaN;
    if (id === undefined || Number.isNaN(idNum)) {
      return errorResponse(res, 'ID inválido o ausente', 400, "Argument 'id' is missing or invalid.");
    }

  const includeRoles = req.query.includeRoles === '1' || req.query.includeRoles === 'true';
  const usuario = await prisma.usuarios.findUnique({
      where: { id: idNum },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        activo: true,
        documentos: true,
  ...(includeRoles && { role: true })
      }
    });

    if (!usuario) {
      return errorResponse(res, 'Usuario no encontrado', 404);
    }

    return successResponse(res, usuario, 'Usuario encontrado');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al obtener usuario', 500, error.message);
  }
});

// POST /api/usuarios - Crear nuevo usuario
router.post('/', async (req, res) => {
  try {
    // Validar que el body exista (evita crash cuando req.body es undefined)
    if (!req.body || Object.keys(req.body).length === 0) {
      return errorResponse(res, 'Body vacío o inválido. Asegúrate de enviar JSON y Content-Type: application/json', 400);
    }

    const { nombre, apellidos, email, password, activo = 1 } = req.body;

    // Validaciones básicas
    if (!email) {
      return errorResponse(res, 'El email es requerido', 400);
    }

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    const nuevoUsuario = await prisma.usuarios.create({
      data: {
        nombre,
        apellidos,
        email,
        password: hashed, // contraseña hasheada
        activo: parseInt(activo)
      },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        activo: true
      }
    });

    return successResponse(res, nuevoUsuario, 'Usuario creado exitosamente', 201);
  } catch (error) {
    console.error(error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'El email ya está en uso', 400);
    }
    return errorResponse(res, 'Error al crear usuario', 500, error.message);
  }
});

// PUT /api/usuarios/:id - Actualizar usuario
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellidos, email, password, activo } = req.body;

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuarios.findUnique({
      where: { id: parseInt(id) }
    });

    if (!usuarioExistente) {
      return errorResponse(res, 'Usuario no encontrado', 404);
    }

    // Actualizar usuario
    const toUpdate = {
      ...(nombre && { nombre }),
      ...(apellidos && { apellidos }),
      ...(email && { email }),
      ...(activo !== undefined && { activo: parseInt(activo) })
    };

    if (password) {
      toUpdate.password = await bcrypt.hash(password, 10);
    }

    const usuarioActualizado = await prisma.usuarios.update({
      where: { id: parseInt(id) },
      data: {
        ...toUpdate
      },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        activo: true
      }
    });

    return successResponse(res, usuarioActualizado, 'Usuario actualizado exitosamente');
  } catch (error) {
    console.error(error);
    if (error.code === 'P2002') {
      return errorResponse(res, 'El email ya está en uso', 400);
    }
    return errorResponse(res, 'Error al actualizar usuario', 500, error.message);
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuarios.findUnique({
      where: { id: parseInt(id) }
    });

    if (!usuarioExistente) {
      return errorResponse(res, 'Usuario no encontrado', 404);
    }

    // Eliminar usuario (los documentos se eliminarán o quedarán huérfanos según configuración)
    await prisma.usuarios.delete({
      where: { id: parseInt(id) }
    });

    return successResponse(res, null, 'Usuario eliminado exitosamente');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al eliminar usuario', 500, error.message);
  }
});

// POST /api/usuarios/:id/roles - Asignar rol a usuario
router.post('/:id/roles', async (req, res) => {
  try {
    const { id } = req.params;
    const { role_tipo } = req.body;

    if (!role_tipo) return errorResponse(res, 'role_tipo es requerido', 400);

    const role = await prisma.roles.findFirst({ where: { tipo: role_tipo } });
    if (!role) return errorResponse(res, 'Rol no encontrado', 404);

  // Asignar role_id al usuario (un solo rol)
  await prisma.usuarios.update({ where: { id: parseInt(id) }, data: { role_id: role.id } });

    return successResponse(res, null, 'Rol asignado al usuario');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al asignar rol', 500, error.message);
  }
});

// DELETE /api/usuarios/:id/roles - Quitar rol a usuario
router.delete('/:id/roles', async (req, res) => {
  try {
    const { id } = req.params;
    const { role_tipo } = req.body;

    if (!role_tipo) return errorResponse(res, 'role_tipo es requerido', 400);

    const role = await prisma.roles.findFirst({ where: { tipo: role_tipo } });
    if (!role) return errorResponse(res, 'Rol no encontrado', 404);

    // Quitar rol estableciendo role_id a null si coincide
    const user = await prisma.usuarios.findUnique({ where: { id: parseInt(id) } });
    if (user && user.role_id === role.id) {
      await prisma.usuarios.update({ where: { id: parseInt(id) }, data: { role_id: null } });
    }

    return successResponse(res, null, 'Rol eliminado del usuario');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al eliminar rol', 500, error.message);
  }
});

// EXPORT ROUTER AT THE END
module.exports = router;
