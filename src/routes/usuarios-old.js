const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../utils/responses");

const prisma = new PrismaClient();

// GET /api/usuarios - Obtener todos los usuarios
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, activo, departamento } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (activo !== undefined) where.activo = parseInt(activo);
    if (departamento) where.departamentos_id = parseInt(departamento);

    const usuarios = await prisma.usuarios.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        usuarios_has_roles: {
          include: {
            roles: true,
          },
        },
        documentos: {
          select: { id: true, nombre: true },
        },
        favoritos: {
          select: { id: true, documento_id: true },
        },
      },
    });

    const total = await prisma.usuarios.count({ where });

    return successResponse(
      res,
      usuarios,
      "Usuarios obtenidos exitosamente",
      200
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al obtener usuarios", 500, error.message);
  }
});

// GET /api/usuarios/:id - Obtener usuario por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuarios.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuarios_has_roles: {
          include: {
            roles: true,
          },
        },
        documentos: true,
        favoritos: {
          include: {
            documento: true,
          },
        },
      },
    });

    if (!usuario) {
      return errorResponse(res, "Usuario no encontrado", 404);
    }

    return successResponse(res, usuario, "Usuario encontrado");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al obtener usuario", 500, error.message);
  }
});

// POST /api/usuarios - Crear nuevo usuario
router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      apellidos,
      email,
      password,
      departamentos_id,
      activo = 1,
      roles,
    } = req.body;

    // Validaciones básicas
    if (!email) {
      return errorResponse(res, "El email es requerido", 400);
    }

    const nuevoUsuario = await prisma.usuarios.create({
      data: {
        nombre,
        apellidos,
        email,
        password, // En producción, hashear la contraseña
        departamentos_id: departamentos_id ? parseInt(departamentos_id) : null,
        activo: parseInt(activo),
      },
    });

    // Asignar roles si se proporcionan
    if (roles && roles.length > 0) {
      const rolesData = roles.map((rolId) => ({
        usuarios_id: nuevoUsuario.id,
        roles_id: parseInt(rolId),
      }));

      await prisma.usuarios_has_roles.createMany({
        data: rolesData,
      });
    }

    const usuarioCompleto = await prisma.usuarios.findUnique({
      where: { id: nuevoUsuario.id },
      include: {
        usuarios_has_roles: {
          include: {
            roles: true,
          },
        },
      },
    });

    return successResponse(
      res,
      usuarioCompleto,
      "Usuario creado exitosamente",
      201
    );
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return errorResponse(res, "El email ya está en uso", 400);
    }
    return errorResponse(res, "Error al crear usuario", 500, error.message);
  }
});

// PUT /api/usuarios/:id - Actualizar usuario
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      apellidos,
      email,
      password,
      departamentos_id,
      activo,
      roles,
    } = req.body;

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuarios.findUnique({
      where: { id: parseInt(id) },
    });

    if (!usuarioExistente) {
      return errorResponse(res, "Usuario no encontrado", 404);
    }

    // Actualizar usuario
    const usuarioActualizado = await prisma.usuarios.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(apellidos && { apellidos }),
        ...(email && { email }),
        ...(password && { password }), // En producción, hashear la contraseña
        ...(departamentos_id !== undefined && {
          departamentos_id: departamentos_id
            ? parseInt(departamentos_id)
            : null,
        }),
        ...(activo !== undefined && { activo: parseInt(activo) }),
      },
    });

    // Actualizar roles si se proporcionan
    if (roles !== undefined) {
      // Eliminar roles existentes
      await prisma.usuarios_has_roles.deleteMany({
        where: { usuarios_id: parseInt(id) },
      });

      // Asignar nuevos roles
      if (roles.length > 0) {
        const rolesData = roles.map((rolId) => ({
          usuarios_id: parseInt(id),
          roles_id: parseInt(rolId),
        }));

        await prisma.usuarios_has_roles.createMany({
          data: rolesData,
        });
      }
    }

    const usuarioCompleto = await prisma.usuarios.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuarios_has_roles: {
          include: {
            roles: true,
          },
        },
      },
    });

    return successResponse(
      res,
      usuarioCompleto,
      "Usuario actualizado exitosamente"
    );
  } catch (error) {
    console.error(error);
    if (error.code === "P2002") {
      return errorResponse(res, "El email ya está en uso", 400);
    }
    return errorResponse(
      res,
      "Error al actualizar usuario",
      500,
      error.message
    );
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const usuarioExistente = await prisma.usuarios.findUnique({
      where: { id: parseInt(id) },
    });

    if (!usuarioExistente) {
      return errorResponse(res, "Usuario no encontrado", 404);
    }

    // Eliminar relaciones primero
    await prisma.usuarios_has_roles.deleteMany({
      where: { usuarios_id: parseInt(id) },
    });

    await prisma.favoritos.deleteMany({
      where: { usuario_id: parseInt(id) },
    });

    // Eliminar usuario
    await prisma.usuarios.delete({
      where: { id: parseInt(id) },
    });

    return successResponse(res, null, "Usuario eliminado exitosamente");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al eliminar usuario", 500, error.message);
  }
});

module.exports = router;
