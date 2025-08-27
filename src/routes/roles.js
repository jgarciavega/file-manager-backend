const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { successResponse, errorResponse } = require("../utils/responses");

const prisma = new PrismaClient();

// GET /api/roles - Obtener todos los roles (público)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 100, includeUsers } = req.query;
    const skip = (page - 1) * limit;
    const wantUsers = includeUsers === '1' || includeUsers === 'true';

    const roles = await prisma.roles.findMany({
      skip: parseInt(skip),
      take: parseInt(limit),
      ...(wantUsers
        ? {
            include: {
              usuarios: {
                include: {
                  usuario: {
                    select: {
                      id: true,
                      nombre: true,
                      apellidos: true,
                      email: true,
                      activo: true,
                    }
                  }
                }
              }
            }
          }
        : { select: { id: true, name: true, descripcion: true } }),
    });

    const total = await prisma.roles.count();

    // Si queremos usuarios, mapear de forma consistente el shape
    const payloadRoles = roles.map((r) => {
      if (!wantUsers) return r;
      // Dependiendo del relation name, prisma puede devolver 'usuarios' o 'usuario_roles'
      // Normalizar: extraer usuarios desde la relación intermedia
      if (r.usuarios) {
        return {
          id: r.id,
          name: r.name || r.tipo || null,
          descripcion: r.descripcion || null,
          usuarios: r.usuarios.map((ur) => ur.usuario),
        };
      }
      // fallback
      return { id: r.id, name: r.name || r.tipo || null, descripcion: r.descripcion || null };
    });

    return successResponse(res, {
      roles: payloadRoles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al obtener roles', 500, error.message);
  }
});

// GET /api/roles/me - roles del usuario autenticado
router.get('/me', async (req, res) => {
  try {
    // loadUserRoles middleware puede poblar req.user.roles, pero aceptamos también que req.user ya tenga roles
    if (!req.user || !req.user.id) return errorResponse(res, 'No autenticado', 401);
    // Si loadUserRoles no se ejecutó, cargar roles aquí
    if (!req.user.roles) {
      const usuario = await prisma.usuarios.findUnique({
        where: { id: req.user.id },
        include: { roles: { include: { role: true } } }
      });
      req.user.roles = usuario?.roles?.map(r => r.role.name) || [];
    }

    return successResponse(res, { id: req.user.id, email: req.user.email, roles: req.user.roles });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al obtener roles del usuario', 500, error.message);
  }
});

// GET /api/roles/:id - Obtener rol por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const rol = await prisma.roles.findUnique({
      where: { id: parseInt(id) },
      include: {
        usuarios_has_roles: {
          include: {
            usuarios: {
              select: { id: true, nombre: true, apellidos: true, email: true },
            },
          },
        },
      },
    });

    if (!rol) {
      return errorResponse(res, "Rol no encontrado", 404);
    }

    return successResponse(res, rol);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al obtener rol", 500, error.message);
  }
});

// POST /api/roles - Crear nuevo rol
router.post("/", async (req, res) => {
  try {
    const { tipo, descripcion, activo = true } = req.body;

    // Validaciones básicas
    if (!tipo) {
      return errorResponse(res, "El tipo de rol es requerido", 400);
    }

    // Validar que el tipo sea válido
    const tiposValidos = ["admin", "capturista", "revisor"];
    if (!tiposValidos.includes(tipo)) {
      return errorResponse(
        res,
        "Tipo de rol inválido. Debe ser: admin, capturista o revisor",
        400
      );
    }

    const nuevoRol = await prisma.roles.create({
      data: {
        tipo,
        descripcion,
        activo,
        fecha_creacion: new Date(),
      },
    });

    return successResponse(res, nuevoRol, "Rol creado exitosamente", 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al crear rol", 500, error.message);
  }
});

// PUT /api/roles/:id - Actualizar rol
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, descripcion, activo } = req.body;

    const rolExistente = await prisma.roles.findUnique({
      where: { id: parseInt(id) },
    });

    if (!rolExistente) {
      return errorResponse(res, "Rol no encontrado", 404);
    }

    // Validar tipo si se está actualizando
    if (tipo) {
      const tiposValidos = ["admin", "capturista", "revisor"];
      if (!tiposValidos.includes(tipo)) {
        return errorResponse(
          res,
          "Tipo de rol inválido. Debe ser: admin, capturista o revisor",
          400
        );
      }
    }

    const rolActualizado = await prisma.roles.update({
      where: { id: parseInt(id) },
      data: {
        ...(tipo && { tipo }),
        ...(descripcion !== undefined && { descripcion }),
        ...(activo !== undefined && { activo }),
      },
    });

    return successResponse(res, rolActualizado, "Rol actualizado exitosamente");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al actualizar rol", 500, error.message);
  }
});

// DELETE /api/roles/:id - Eliminar rol
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const rolExistente = await prisma.roles.findUnique({
      where: { id: parseInt(id) },
    });

    if (!rolExistente) {
      return errorResponse(res, "Rol no encontrado", 404);
    }

    // Verificar si hay usuarios asociados
    const usuariosAsociados = await prisma.usuarios_has_roles.count({
      where: { roles_id: parseInt(id) },
    });

    if (usuariosAsociados > 0) {
      return errorResponse(
        res,
        "No se puede eliminar el rol porque tiene usuarios asociados",
        400
      );
    }

    await prisma.roles.delete({
      where: { id: parseInt(id) },
    });

    return successResponse(res, null, "Rol eliminado exitosamente");
  } catch (error) {
    console.error(error);
    return errorResponse(res, "Error al eliminar rol", 500, error.message);
  }
});

// GET /api/roles/:id/usuarios - Obtener usuarios con un rol específico
router.get("/:id/usuarios", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const usuariosConRol = await prisma.usuarios_has_roles.findMany({
      where: { roles_id: parseInt(id) },
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        usuarios: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            email: true,
            activo: true,
            departamentos_id: true,
          },
        },
      },
    });

    const total = await prisma.usuarios_has_roles.count({
      where: { roles_id: parseInt(id) },
    });

    const usuarios = usuariosConRol.map((item) => item.usuarios);

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
      "Error al obtener usuarios del rol",
      500,
      error.message
    );
  }
});

// GET /api/roles/tipos - Obtener tipos de roles disponibles
router.get("/meta/tipos", async (req, res) => {
  try {
    const tipos = [
      { value: "admin", label: "Administrador" },
      { value: "capturista", label: "Capturista" },
      { value: "revisor", label: "Revisor" },
    ];

    return successResponse(res, tipos, "Tipos de roles obtenidos exitosamente");
  } catch (error) {
    console.error(error);
    return errorResponse(
      res,
      "Error al obtener tipos de roles",
      500,
      error.message
    );
  }
});

module.exports = router;
