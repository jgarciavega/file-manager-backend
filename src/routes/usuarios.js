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
  // Obtener usuario completo con role y departamentos
  const usuarioFull = await prisma.usuarios.findUnique({ where: { id: u.id }, include: { role: true, departamentos: true } });
  const rol = usuarioFull && usuarioFull.role ? usuarioFull.role.tipo : null;
  const departamento = usuarioFull && usuarioFull.departamentos ? { id: usuarioFull.departamentos.id, nombre: usuarioFull.departamentos.nombre } : null;

      const docsCount = await prisma.documentos.count({ where: { usuarios_id: u.id } });

      const lastAct = await prisma.bitacora.findFirst({ where: { usuario_id: u.id }, orderBy: { fecha_inicio: 'desc' } });

      return {
        ...u,
        rol,
        departamento,
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

    // Validar y parsear ID
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
    if (!req.body || Object.keys(req.body).length === 0) {
      return errorResponse(res, 'Body vacío o inválido. Asegúrate de enviar JSON y Content-Type: application/json', 400);
    }

    let { nombre, apellidos, email, password, activo = undefined, role_tipo, role_id, departamentos_id } = req.body;
    nombre = nombre !== undefined && nombre !== null ? String(nombre).trim() : undefined;
    apellidos = apellidos !== undefined && apellidos !== null ? String(apellidos).trim() : undefined;
    email = email !== undefined && email !== null ? String(email).trim() : undefined;
    role_tipo = role_tipo !== undefined && role_tipo !== null ? String(role_tipo).trim() : undefined;

    // Normalizar email a minúsculas para evitar duplicados por mayúsculas/minúsculas
    const normalizedEmail = email ? String(email).toLowerCase() : undefined;
    if (normalizedEmail) {
      // Comprobar si ya existe un usuario con ese email
      const existingEmail = await prisma.usuarios.findFirst({ where: { email: normalizedEmail } });
      if (existingEmail) return errorResponse(res, 'El email ya está en uso', 409);
    }

    // Reemplazar email por la versión normalizada antes de validar formato
    if (normalizedEmail) email = normalizedEmail;

    // Validaciones únicamente si se envía el campo
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (email && !emailRegex.test(email)) {
      return errorResponse(res, 'El email tiene un formato inválido', 400);
    }

    if (password && String(password).length < 8) {
      return errorResponse(res, 'La contraseña debe tener al menos 8 caracteres', 400);
    }

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    // Manejar rol (igual que antes)
    let assignedRoleId = null;
    if (role_id !== undefined && role_id !== null && role_id !== '') {
      const parsedRoleId = parseInt(role_id, 10);
      if (Number.isNaN(parsedRoleId)) return errorResponse(res, 'role_id inválido', 400);
      const roleExist = await prisma.roles.findUnique({ where: { id: parsedRoleId } });
      if (!roleExist) return errorResponse(res, 'Rol no encontrado por id', 404);
      assignedRoleId = parsedRoleId;
    } else if (role_tipo) {
      let roleObj = await prisma.roles.findFirst({ where: { tipo: role_tipo } });
      if (!roleObj) {
        try {
          roleObj = await prisma.roles.create({ data: { tipo: role_tipo, descripcion: null, activo: true, fecha_creacion: new Date() } });
        } catch (err) {
          console.error('Error creando rol:', err);
          return errorResponse(res, 'role_tipo inválido o no se pudo crear el rol', 400, err.message);
        }
      }
      assignedRoleId = roleObj.id;
    }

    // Manejar departamento: buscar por nombre o validar id
    let assignedDeptId = null;
    if (departamentos_id !== undefined && departamentos_id !== null && departamentos_id !== '') {
      if (typeof departamentos_id === 'string' && isNaN(Number(departamentos_id))) {
        // Normalizar nombre (trim) y buscar de forma case-insensitive
        const deptName = String(departamentos_id).trim();
        // Usar equals simple (la sensibilidad a mayúsculas depende de la collation de la BD)
        const dept = await prisma.departamentos.findFirst({ where: { nombre: { equals: deptName } } });
        if (!dept) return errorResponse(res, 'Departamento no encontrado', 404);
        assignedDeptId = dept.id;
      } else {
        const parsedDeptId = parseInt(departamentos_id, 10);
        if (Number.isNaN(parsedDeptId)) return errorResponse(res, 'departamentos_id inválido', 400);
        const deptExist = await prisma.departamentos.findUnique({ where: { id: parsedDeptId } });
        if (!deptExist) return errorResponse(res, 'Departamento no encontrado por id', 404);
        assignedDeptId = parsedDeptId;
      }
    }

    // Construir data sólo con campos definidos
    const dataToCreate = {
      ...(nombre !== undefined && { nombre }),
      ...(apellidos !== undefined && { apellidos }),
      ...(email !== undefined && { email }),
      ...(hashed !== undefined && { password: hashed }),
      ...(activo !== undefined && { activo: parseInt(activo) }),
      ...(assignedRoleId !== null && { role_id: assignedRoleId }),
      ...(assignedDeptId !== null && { departamentos_id: assignedDeptId })
    };

    const nuevoUsuario = await prisma.usuarios.create({
      data: dataToCreate,
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        activo: true,
        role_id: true,
        departamentos_id: true
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
    const idNum = id !== undefined ? parseInt(id, 10) : NaN;
    if (id === undefined || Number.isNaN(idNum)) {
      return errorResponse(res, 'ID inválido o ausente', 400, "Argument 'id' is missing or invalid.");
    }

    const usuarioExistente = await prisma.usuarios.findUnique({ where: { id: idNum } });
    if (!usuarioExistente) return errorResponse(res, 'Usuario no encontrado', 404);

    await prisma.usuarios.update({ where: { id: idNum }, data: { role_id: null } });

    return successResponse(res, null, 'Rol removido del usuario');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al remover rol', 500, error.message);
  }
});

// Exportar el router (asegurar compatibilidad con app.js)
module.exports = router;
