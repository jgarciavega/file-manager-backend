const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../utils/responses");
const { verifyToken } = require('../middleware/auth');
const { loadUserRoles, requireRole } = require('../middleware/roles');

const prisma = new PrismaClient();

// GET /api/departamentos - Obtener todos los departamentos
router.get("/", async (req, res) => {
  try {
    const { activo, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (activo !== undefined) where.activo = activo === "true";

    const departamentos = await prisma.departamentos.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { nombre: "asc" },
    });

    const total = await prisma.departamentos.count({ where });

    return successResponse(res, {
      departamentos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener departamentos",
      500,
      error.message
    );
  }
});

// GET /api/departamentos/:id - Obtener departamento por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const departamento = await prisma.departamentos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!departamento) {
      return errorResponse(res, "Departamento no encontrado", 404);
    }

    return successResponse(res, departamento);
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener departamento",
      500,
      error.message
    );
  }
});

// POST /api/departamentos - Crear nuevo departamento (ADMIN)
router.post("/", verifyToken, loadUserRoles, requireRole('admin'), async (req, res) => {
  try {
    const { nombre, descripcion, activo = true } = req.body;

    // Validaciones básicas
    if (!nombre) {
      return errorResponse(res, "El nombre es requerido", 400);
    }

    const nuevoDepartamento = await prisma.departamentos.create({
      data: {
        nombre,
        descripcion,
        activo,
      },
    });

    return successResponse(
      res,
      nuevoDepartamento,
      "Departamento creado exitosamente",
      201
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al crear departamento",
      500,
      error.message
    );
  }
});

// PUT /api/departamentos/:id - Actualizar departamento (ADMIN)
router.put("/:id", verifyToken, loadUserRoles, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;

    const departamentoExistente = await prisma.departamentos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!departamentoExistente) {
      return errorResponse(res, "Departamento no encontrado", 404);
    }

    const departamentoActualizado = await prisma.departamentos.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion !== undefined && { descripcion }),
        ...(activo !== undefined && { activo }),
      },
    });

    return successResponse(
      res,
      departamentoActualizado,
      "Departamento actualizado exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al actualizar departamento",
      500,
      error.message
    );
  }
});

// DELETE /api/departamentos/:id - Eliminar departamento (ADMIN)
router.delete("/:id", verifyToken, loadUserRoles, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const departamentoExistente = await prisma.departamentos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!departamentoExistente) {
      return errorResponse(res, "Departamento no encontrado", 404);
    }

    // Verificar si hay usuarios asociados
    const usuariosAsociados = await prisma.usuarios.count({
      where: { departamentos_id: parseInt(id) },
    });

    if (usuariosAsociados > 0) {
      return errorResponse(
        res,
        "No se puede eliminar el departamento porque tiene usuarios asociados",
        400
      );
    }

    await prisma.departamentos.delete({
      where: { id: parseInt(id) },
    });

    return successResponse(res, null, "Departamento eliminado exitosamente");
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al eliminar departamento",
      500,
      error.message
    );
  }
});

// GET /api/departamentos/:id/usuarios - Obtener usuarios de un departamento
router.get("/:id/usuarios", async (req, res) => {
  try {
    const { id } = req.params;
    const { activo, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = { departamentos_id: parseInt(id) };
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
      },
      orderBy: { nombre: "asc" },
    });

    const total = await prisma.usuarios.count({ where });

    return successResponse(res, {
      usuarios,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener usuarios del departamento",
      500,
      error.message
    );
  }
});

module.exports = router;
