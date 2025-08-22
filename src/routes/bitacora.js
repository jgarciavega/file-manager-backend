const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../utils/responses");

const prisma = new PrismaClient();

// GET /api/bitacora - Obtener registros de bitácora
router.get("/", async (req, res) => {
  try {
    const {
      usuario_id,
      rol,
      accion,
      fecha_desde,
      fecha_hasta,
      page = 1,
      limit = 20,
    } = req.query;

    const skip = (page - 1) * limit;

    const where = {};
    if (usuario_id) where.usuario_id = parseInt(usuario_id);
    if (rol) where.rol = { contains: rol };
    if (accion) where.accion = { contains: accion };

    if (fecha_desde || fecha_hasta) {
      where.fecha_inicio = {};
      if (fecha_desde) where.fecha_inicio.gte = new Date(fecha_desde);
      if (fecha_hasta) where.fecha_inicio.lte = new Date(fecha_hasta);
    }

    const registros = await prisma.bitacora.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { fecha_inicio: "desc" },
    });

    const total = await prisma.bitacora.count({ where });

    return successResponse(res, {
      registros,
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
      "Error al obtener registros de bitácora",
      500,
      error.message
    );
  }
});

// GET /api/bitacora/:id - Obtener registro específico de bitácora
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const registro = await prisma.bitacora.findUnique({
      where: { id: parseInt(id) },
    });

    if (!registro) {
      return errorResponse(res, "Registro de bitácora no encontrado", 404);
    }

    return successResponse(res, registro);
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener registro de bitácora",
      500,
      error.message
    );
  }
});

// POST /api/bitacora - Crear registro de bitácora
router.post("/", async (req, res) => {
  try {
    const { usuario_id, rol, accion, ip, descripcion } = req.body;

    // Validaciones básicas
    if (!accion) {
      return errorResponse(res, "La acción es requerida", 400);
    }

    // Si no se proporciona IP, intentar obtenerla del request
    const ipAddress =
      ip || req.ip || req.connection.remoteAddress || "No disponible";

    const nuevoRegistro = await prisma.bitacora.create({
      data: {
        usuario_id: usuario_id ? parseInt(usuario_id) : null,
        rol,
        accion,
        ip: ipAddress,
        descripcion,
        fecha_inicio: new Date(),
        fecha_act: new Date(),
      },
    });

    return successResponse(
      res,
      nuevoRegistro,
      "Registro de bitácora creado exitosamente",
      201
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al crear registro de bitácora",
      500,
      error.message
    );
  }
});

// PUT /api/bitacora/:id - Actualizar registro de bitácora
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { usuario_id, rol, accion, ip, descripcion } = req.body;

    const registroExistente = await prisma.bitacora.findUnique({
      where: { id: parseInt(id) },
    });

    if (!registroExistente) {
      return errorResponse(res, "Registro de bitácora no encontrado", 404);
    }

    const registroActualizado = await prisma.bitacora.update({
      where: { id: parseInt(id) },
      data: {
        ...(usuario_id !== undefined && {
          usuario_id: usuario_id ? parseInt(usuario_id) : null,
        }),
        ...(rol !== undefined && { rol }),
        ...(accion && { accion }),
        ...(ip !== undefined && { ip }),
        ...(descripcion !== undefined && { descripcion }),
        fecha_act: new Date(),
      },
    });

    return successResponse(
      res,
      registroActualizado,
      "Registro de bitácora actualizado exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al actualizar registro de bitácora",
      500,
      error.message
    );
  }
});

// DELETE /api/bitacora/:id - Eliminar registro de bitácora
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const registroExistente = await prisma.bitacora.findUnique({
      where: { id: parseInt(id) },
    });

    if (!registroExistente) {
      return errorResponse(res, "Registro de bitácora no encontrado", 404);
    }

    await prisma.bitacora.delete({
      where: { id: parseInt(id) },
    });

    return successResponse(
      res,
      null,
      "Registro de bitácora eliminado exitosamente"
    );
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al eliminar registro de bitácora",
      500,
      error.message
    );
  }
});

// GET /api/bitacora/usuario/:usuario_id - Obtener bitácora de un usuario específico
router.get("/usuario/:usuario_id", async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const registros = await prisma.bitacora.findMany({
      where: { usuario_id: parseInt(usuario_id) },
      skip: parseInt(skip),
      take: parseInt(limit),
      orderBy: { fecha_inicio: "desc" },
    });

    const total = await prisma.bitacora.count({
      where: { usuario_id: parseInt(usuario_id) },
    });

    return successResponse(res, {
      registros,
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
      "Error al obtener bitácora del usuario",
      500,
      error.message
    );
  }
});

// GET /api/bitacora/estadisticas - Obtener estadísticas de la bitácora
router.get("/meta/estadisticas", async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta } = req.query;

    const where = {};
    if (fecha_desde || fecha_hasta) {
      where.fecha_inicio = {};
      if (fecha_desde) where.fecha_inicio.gte = new Date(fecha_desde);
      if (fecha_hasta) where.fecha_inicio.lte = new Date(fecha_hasta);
    }

    const totalRegistros = await prisma.bitacora.count({ where });

    // Contar por roles
    const registrosPorRol = await prisma.bitacora.groupBy({
      by: ["rol"],
      where,
      _count: { rol: true },
      orderBy: { _count: { rol: "desc" } },
    });

    // Contar por acciones
    const registrosPorAccion = await prisma.bitacora.groupBy({
      by: ["accion"],
      where,
      _count: { accion: true },
      orderBy: { _count: { accion: "desc" } },
      take: 10, // Top 10 acciones
    });

    // Usuarios más activos
    const usuariosMasActivos = await prisma.bitacora.groupBy({
      by: ["usuario_id"],
      where: {
        ...where,
        usuario_id: { not: null },
      },
      _count: { usuario_id: true },
      orderBy: { _count: { usuario_id: "desc" } },
      take: 10,
    });

    const estadisticas = {
      totalRegistros,
      registrosPorRol: registrosPorRol.map((item) => ({
        rol: item.rol || "Sin rol",
        cantidad: item._count.rol,
      })),
      registrosPorAccion: registrosPorAccion.map((item) => ({
        accion: item.accion || "Sin acción",
        cantidad: item._count.accion,
      })),
      usuariosMasActivos: usuariosMasActivos.map((item) => ({
        usuario_id: item.usuario_id,
        cantidad: item._count.usuario_id,
      })),
    };

    return successResponse(
      res,
      estadisticas,
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

// POST /api/bitacora/limpiar - Limpiar registros antiguos de bitácora
router.post("/limpiar", async (req, res) => {
  try {
    const { dias = 90 } = req.body; // Por defecto, eliminar registros de más de 90 días

    if (dias < 1) {
      return errorResponse(res, "El número de días debe ser mayor a 0", 400);
    }

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    const resultado = await prisma.bitacora.deleteMany({
      where: {
        fecha_inicio: {
          lt: fechaLimite,
        },
      },
    });

    return successResponse(
      res,
      {
        registrosEliminados: resultado.count,
        fechaLimite,
      },
      `Bitácora limpiada. Se eliminaron ${
        resultado.count
      } registros anteriores a ${fechaLimite.toLocaleDateString()}`
    );
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al limpiar bitácora", 500, error.message);
  }
});

// Middleware para registrar automáticamente en bitácora (exportar para usar en otras rutas)
const registrarEnBitacora = (accion, descripcion = "") => {
  return async (req, res, next) => {
    try {
      // Obtener información del usuario si está disponible
      const usuario_id = req.user?.id || null;
      const rol = req.user?.rol || "invitado";
      const ip = req.ip || req.connection.remoteAddress || "No disponible";

      await prisma.bitacora.create({
        data: {
          usuario_id,
          rol,
          accion,
          ip,
          descripcion:
            descripcion || `${accion} - ${req.method} ${req.originalUrl}`,
          fecha_inicio: new Date(),
          fecha_act: new Date(),
        },
      });
    } catch (error) {
      console.error("Error al registrar en bitácora:", error);
      // No interrumpir el flujo si hay error en la bitácora
    }
    next();
  };
};

module.exports = { router, registrarEnBitacora };
