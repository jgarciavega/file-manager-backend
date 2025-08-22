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
        }
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const usuario = await prisma.usuarios.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        email: true,
        activo: true,
        documentos: true
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

module.exports = router;
