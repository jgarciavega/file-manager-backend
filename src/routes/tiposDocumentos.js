const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../utils/responses");

const prisma = new PrismaClient();

// GET /api/tipos-documentos - Obtener todos los tipos de documentos
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const tiposDocumentos = await prisma.tipos_documentos.findMany({
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        documentos: {
          select: { id: true, nombre: true },
        },
      },
      orderBy: { tipo: "asc" },
    });

    const total = await prisma.tipos_documentos.count();

    return successResponse(res, {
      tiposDocumentos,
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
      "Error al obtener tipos de documentos",
      500,
      error.message
    );
  }
});

// GET /api/tipos-documentos/:id - Obtener tipo de documento por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const tipoDocumento = await prisma.tipos_documentos.findUnique({
      where: { id: parseInt(id) },
      include: {
        documentos: {
          include: {
            usuarios: {
              select: { id: true, nombre: true, apellidos: true },
            },
          },
        },
      },
    });

    if (!tipoDocumento) {
      return errorResponse(res, "Tipo de documento no encontrado", 404);
    }

    return successResponse(res, tipoDocumento);
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener tipo de documento",
      500,
      error.message
    );
  }
});

// POST /api/tipos-documentos - Crear nuevo tipo de documento
router.post("/", async (req, res) => {
  try {
    const { tipo } = req.body;

    // Validaciones básicas
    if (!tipo) {
      return errorResponse(res, "El tipo es requerido", 400);
    }

    // Verificar si ya existe un tipo con el mismo nombre
    const tipoExistente = await prisma.tipos_documentos.findFirst({
      where: { tipo: tipo.toLowerCase() },
    });

    if (tipoExistente) {
      return errorResponse(
        res,
        "Ya existe un tipo de documento con este nombre",
        400
      );
    }

    const nuevoTipoDocumento = await prisma.tipos_documentos.create({
      data: {
        tipo: tipo.toLowerCase(),
      },
    });

    return successResponse(
      res,
      nuevoTipoDocumento,
      "Tipo de documento creado exitosamente",
      201
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al crear tipo de documento",
      500,
      error.message
    );
  }
});

// PUT /api/tipos-documentos/:id - Actualizar tipo de documento
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo } = req.body;

    const tipoDocumentoExistente = await prisma.tipos_documentos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!tipoDocumentoExistente) {
      return errorResponse(res, "Tipo de documento no encontrado", 404);
    }

    // Si se está actualizando el tipo, verificar que no exista otro con el mismo nombre
    if (tipo && tipo.toLowerCase() !== tipoDocumentoExistente.tipo) {
      const tipoConMismoNombre = await prisma.tipos_documentos.findFirst({
        where: {
          tipo: tipo.toLowerCase(),
          id: { not: parseInt(id) },
        },
      });

      if (tipoConMismoNombre) {
        return errorResponse(
          res,
          "Ya existe otro tipo de documento con este nombre",
          400
        );
      }
    }

    const tipoDocumentoActualizado = await prisma.tipos_documentos.update({
      where: { id: parseInt(id) },
      data: {
        ...(tipo && { tipo: tipo.toLowerCase() }),
      },
    });

    return successResponse(
      res,
      tipoDocumentoActualizado,
      "Tipo de documento actualizado exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al actualizar tipo de documento",
      500,
      error.message
    );
  }
});

// DELETE /api/tipos-documentos/:id - Eliminar tipo de documento
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const tipoDocumentoExistente = await prisma.tipos_documentos.findUnique({
      where: { id: parseInt(id) },
    });

    if (!tipoDocumentoExistente) {
      return errorResponse(res, "Tipo de documento no encontrado", 404);
    }

    // Verificar si hay documentos asociados
    const documentosAsociados = await prisma.documentos.count({
      where: { tipos_documentos_id: parseInt(id) },
    });

    if (documentosAsociados > 0) {
      return errorResponse(
        res,
        "No se puede eliminar el tipo de documento porque tiene documentos asociados",
        400
      );
    }

    await prisma.tipos_documentos.delete({
      where: { id: parseInt(id) },
    });

    return successResponse(
      res,
      null,
      "Tipo de documento eliminado exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al eliminar tipo de documento",
      500,
      error.message
    );
  }
});

// GET /api/tipos-documentos/:id/documentos - Obtener documentos de un tipo específico
router.get("/:id/documentos", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const documentos = await prisma.documentos.findMany({
      where: { tipos_documentos_id: parseInt(id) },
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true },
        },
        tipos_documentos: true,
      },
      orderBy: { fecha_subida: "desc" },
    });

    const total = await prisma.documentos.count({
      where: { tipos_documentos_id: parseInt(id) },
    });

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
      "Error al obtener documentos del tipo",
      500,
      error.message
    );
  }
});

// GET /api/tipos-documentos/estadisticas - Obtener estadísticas de tipos de documentos
router.get("/meta/estadisticas", async (req, res) => {
  try {
    const estadisticas = await prisma.tipos_documentos.findMany({
      include: {
        _count: {
          select: { documentos: true },
        },
      },
      orderBy: { tipo: "asc" },
    });

    const resultado = estadisticas.map((tipo) => ({
      id: tipo.id,
      tipo: tipo.tipo,
      cantidadDocumentos: tipo._count.documentos,
    }));

    return successResponse(
      res,
      resultado,
      "Estadísticas obtenidas exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener estadísticas",
      500,
      error.message
    );
  }
});

module.exports = router;
