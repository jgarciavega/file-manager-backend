const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../utils/responses");

const prisma = new PrismaClient();

// GET /api/documentos - Obtener todos los documentos
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, usuario_id, tipo_id, mime } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (usuario_id) where.usuarios_id = parseInt(usuario_id);
    if (tipo_id) where.tipos_documentos_id = parseInt(tipo_id);
    if (mime) where.mime = { contains: mime };

    const documentos = await prisma.documentos.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true, email: true },
        },
        tipos_documentos: true,
        favoritos: {
          select: { id: true, usuario_id: true },
        },
      },
      orderBy: { fecha_subida: "desc" },
    });

    const total = await prisma.documentos.count({ where });

    return successResponse(res, {
      documentos,
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
      "Error al obtener documentos",
      500,
      error.message
    );
  }
});

// GET /api/documentos/:id - Obtener documento por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const documento = await prisma.documentos.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true, email: true },
        },
        tipos_documentos: true,
        favoritos: {
          include: {
            usuario: {
              select: { id: true, nombre: true, apellidos: true },
            },
          },
        },
      },
    });

    if (!documento) {
      return errorResponse(res, "Documento no encontrado", 404);
    }

    return successResponse(res, documento);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al obtener documento", 500, error.message);
  }
});

// POST /api/documentos - Crear nuevo documento
router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      mime,
      ruta,
      tipos_documentos_id,
      usuarios_id,
    } = req.body;

    // Validaciones básicas
    if (!nombre || !ruta || !usuarios_id) {
      return errorResponse(res, "Nombre, ruta y usuario son requeridos", 400);
    }

    const nuevoDocumento = await prisma.documentos.create({
      data: {
        nombre,
        descripcion,
        mime,
        ruta,
        tipos_documentos_id: tipos_documentos_id
          ? parseInt(tipos_documentos_id)
          : null,
        usuarios_id: parseInt(usuarios_id),
        fecha_subida: new Date(),
      },
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true },
        },
        tipos_documentos: true,
      },
    });

    return successResponse(
      res,
      nuevoDocumento,
      "Documento creado exitosamente",
      201
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al crear documento", 500, error.message);
  }
});

// PUT /api/documentos/:id - Actualizar documento
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, mime, ruta, tipos_documentos_id } = req.body;

    const documentoExistente = await prisma.documentos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!documentoExistente) {
      return errorResponse(res, "Documento no encontrado", 404);
    }

    const documentoActualizado = await prisma.documentos.update({
      where: { id: parseInt(id) },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion && { descripcion }),
        ...(mime && { mime }),
        ...(ruta && { ruta }),
        ...(tipos_documentos_id !== undefined && {
          tipos_documentos_id: tipos_documentos_id
            ? parseInt(tipos_documentos_id)
            : null,
        }),
      },
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true },
        },
        tipos_documentos: true,
      },
    });

    return successResponse(
      res,
      documentoActualizado,
      "Documento actualizado exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al actualizar documento",
      500,
      error.message
    );
  }
});

// DELETE /api/documentos/:id - Eliminar documento
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const documentoExistente = await prisma.documentos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!documentoExistente) {
      return errorResponse(res, "Documento no encontrado", 404);
    }

    // Eliminar favoritos relacionados
    await prisma.favoritos.deleteMany({
      where: { documento_id: parseInt(id) },
    });

    // Eliminar documento
    await prisma.documentos.delete({
      where: { id: parseInt(id) },
    });

    return successResponse(res, null, "Documento eliminado exitosamente");
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al eliminar documento",
      500,
      error.message
    );
  }
});

module.exports = router;
