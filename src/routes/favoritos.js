const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../utils/responses");

const prisma = new PrismaClient();

// GET /api/favoritos - Obtener todos los favoritos (con filtros)
router.get("/", async (req, res) => {
  try {
    const { usuario_id, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (usuario_id) where.usuario_id = parseInt(usuario_id);

    const favoritos = await prisma.favoritos.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        documento: {
          include: {
            usuarios: {
              select: { id: true, nombre: true, apellidos: true },
            },
            tipos_documentos: true,
          },
        },
        usuario: {
          select: { id: true, nombre: true, apellidos: true, email: true },
        },
      },
      orderBy: { fecha: "desc" },
    });

    const total = await prisma.favoritos.count({ where });

    return successResponse(res, {
      favoritos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al obtener favoritos", 500, error.message);
  }
});

// GET /api/favoritos/usuario/:usuario_id - Obtener favoritos de un usuario específico
router.get("/usuario/:usuario_id", async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const favoritos = await prisma.favoritos.findMany({
      where: { usuario_id: parseInt(usuario_id) },
      include: {
        documento: {
          include: {
            tipos_documentos: true,
            usuarios: {
              select: { id: true, nombre: true, apellidos: true },
            },
          },
        },
      },
      orderBy: { fecha: "desc" },
    });

    return successResponse(
      res,
      favoritos,
      "Favoritos del usuario obtenidos exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener favoritos del usuario",
      500,
      error.message
    );
  }
});

// POST /api/favoritos - Agregar documento a favoritos
router.post("/", async (req, res) => {
  try {
    const { documento_id, usuario_id } = req.body;

    // Validaciones básicas
    if (!documento_id || !usuario_id) {
      return errorResponse(
        res,
        "documento_id y usuario_id son requeridos",
        400
      );
    }

    // Verificar si el documento existe
    const documento = await prisma.documentos.findUnique({
      where: { id: parseInt(documento_id) },
    });

    if (!documento) {
      return errorResponse(res, "Documento no encontrado", 404);
    }

    // Verificar si el usuario existe
    const usuario = await prisma.usuarios.findUnique({
      where: { id: parseInt(usuario_id) },
    });

    if (!usuario) {
      return errorResponse(res, "Usuario no encontrado", 404);
    }

    // Verificar si ya existe el favorito
    const favoritoExistente = await prisma.favoritos.findFirst({
      where: {
        documento_id: parseInt(documento_id),
        usuario_id: parseInt(usuario_id),
      },
    });

    if (favoritoExistente) {
      return errorResponse(res, "Este documento ya está en favoritos", 400);
    }

    // Crear el favorito
    const nuevoFavorito = await prisma.favoritos.create({
      data: {
        documento_id: parseInt(documento_id),
        usuario_id: parseInt(usuario_id),
        fecha: new Date(),
      },
      include: {
        documento: {
          include: {
            tipos_documentos: true,
          },
        },
        usuario: {
          select: { id: true, nombre: true, apellidos: true },
        },
      },
    });

    return successResponse(
      res,
      nuevoFavorito,
      "Documento agregado a favoritos exitosamente",
      201
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al agregar a favoritos",
      500,
      error.message
    );
  }
});

// DELETE /api/favoritos/:id - Eliminar favorito por ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const favoritoExistente = await prisma.favoritos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!favoritoExistente) {
      return errorResponse(res, "Favorito no encontrado", 404);
    }

    await prisma.favoritos.delete({
      where: { id: parseInt(id) },
    });

    return successResponse(res, null, "Favorito eliminado exitosamente");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al eliminar favorito", 500, error.message);
  }
});

// DELETE /api/favoritos/documento/:documento_id/usuario/:usuario_id - Eliminar favorito por documento y usuario
router.delete(
  "/documento/:documento_id/usuario/:usuario_id",
  async (req, res) => {
    try {
      const { documento_id, usuario_id } = req.params;

      const favorito = await prisma.favoritos.findFirst({
        where: {
          documento_id: parseInt(documento_id),
          usuario_id: parseInt(usuario_id),
        },
      });

      if (!favorito) {
        return errorResponse(res, "Favorito no encontrado", 404);
      }

      await prisma.favoritos.delete({
        where: { id: favorito.id },
      });

      return successResponse(
        res,
        null,
        "Documento eliminado de favoritos exitosamente"
      );
    } catch (error) {
      console.error(error);
      return errorResponse(
        res,
        "Error al eliminar favorito",
        500,
        error.message
      );
    }
  }
);

// GET /api/favoritos/check/:documento_id/:usuario_id - Verificar si un documento está en favoritos de un usuario
router.get("/check/:documento_id/:usuario_id", async (req, res) => {
  try {
    const { documento_id, usuario_id } = req.params;

    const favorito = await prisma.favoritos.findFirst({
      where: {
        documento_id: parseInt(documento_id),
        usuario_id: parseInt(usuario_id),
      },
    });

    return successResponse(res, {
      esFavorito: !!favorito,
      favorito: favorito || null,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al verificar favorito",
      500,
      error.message
    );
  }
});

module.exports = router;
