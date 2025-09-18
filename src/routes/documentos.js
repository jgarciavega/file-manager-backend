const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');
const { verifyToken } = require('../middleware/auth');
const { loadUserRoles, requireAnyRole, requireRole } = require('../middleware/roles');

const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// configurar multer
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// límites y filtro MIME: sólo PDF, Word y Excel; tamaño máximo 50MB
const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido. Solo PDF, Word y Excel.'));
  }
});

// GET /api/documentos - Obtener todos los documentos
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, usuario_id, mime } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (usuario_id) where.usuarios_id = parseInt(usuario_id);
    if (mime) where.mime = { contains: mime };

    const documentos = await prisma.documentos.findMany({
      where,
      skip: parseInt(skip),
      take: parseInt(limit),
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true, email: true }
        }
      },
      orderBy: { fecha_subida: 'desc' }
    });

    const total = await prisma.documentos.count({ where });

    return successResponse(res, {
      documentos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al obtener documentos', 500, error.message);
  }
});

// GET /api/documentos/:id - Obtener documento por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docId = parseInt(id);
    if (isNaN(docId)) return errorResponse(res, 'ID inválido', 400);

    const documento = await prisma.documentos.findUnique({
      where: { id: docId },
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true, email: true }
        }
      }
    });

    if (!documento) {
      return errorResponse(res, 'Documento no encontrado', 404);
    }

    return successResponse(res, documento);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al obtener documento', 500, error.message);
  }
});

// POST /api/documentos - Crear nuevo documento (autenticado)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { 
      nombre, 
      descripcion, 
      mime, 
      ruta, 
      usuarios_id 
    } = req.body;

    // Validaciones básicas
    if (!nombre || !ruta || !usuarios_id) {
      return errorResponse(res, 'Nombre, ruta y usuario son requeridos', 400);
    }

    // Validaciones adicionales
    if (typeof nombre !== 'string' || nombre.length < 3 || nombre.length > 255) {
      return errorResponse(res, 'Nombre inválido (3-255 caracteres)', 400);
    }

    if (ruta && ruta.startsWith('uploads/')) {
      const fullPath = path.join(__dirname, '..', '..', ruta);
      if (!fs.existsSync(fullPath)) {
        return errorResponse(res, 'El archivo indicado en ruta no existe en servidor', 400);
      }
    }

    const nuevoDocumento = await prisma.documentos.create({
      data: {
        nombre,
        descripcion,
        mime,
        ruta,
        usuarios_id: parseInt(usuarios_id),
        fecha_subida: new Date()
      },
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true }
        }
      }
    });

    // registrar en bitácora (no bloquear la respuesta si falla)
    (async () => {
      try {
        await prisma.bitacora.create({
          data: {
            usuario_id: parseInt(usuarios_id) || null,
            accion: 'creacion',
            descripcion: `Creó documento ${nuevoDocumento.nombre} -> ${nuevoDocumento.ruta}`,
            fecha_inicio: new Date(),
            fecha_act: new Date()
          }
        });
      } catch (e) {
        console.error('Error al registrar creación en bitácora:', e);
      }
    })();

    // añadir URL de descarga si aplica
    let download_url = null;
    if (nuevoDocumento.ruta && nuevoDocumento.ruta.startsWith('uploads/')) {
      const host = req.get('host');
      const protocol = req.protocol;
      download_url = `${protocol}://${host}/${nuevoDocumento.ruta}`;
    }

    const payload = { ...nuevoDocumento, download_url };

    return successResponse(res, payload, 'Documento creado exitosamente', 201);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al crear documento', 500, error.message);
  }
});

// PUT /api/documentos/:id - Actualizar documento (autenticado)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, mime, ruta } = req.body;

    const docId = parseInt(id);
    if (isNaN(docId)) return errorResponse(res, 'ID inválido', 400);

    const documentoExistente = await prisma.documentos.findUnique({
      where: { id: docId }
    });

    if (!documentoExistente) {
      return errorResponse(res, 'Documento no encontrado', 404);
    }

    const documentoActualizado = await prisma.documentos.update({
  where: { id: docId },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion && { descripcion }),
        ...(mime && { mime }),
        ...(ruta && { ruta })
      },
      include: {
        usuarios: {
          select: { id: true, nombre: true, apellidos: true }
        }
      }
    });

    // registrar actualización en bitácora (no bloquear la respuesta si falla)
    (async () => {
      try {
        const usuarioId = documentoActualizado.usuarios_id || null;
        await prisma.bitacora.create({
          data: {
            usuario_id: usuarioId,
            accion: 'actualizacion',
            descripcion: `Actualizó documento ${documentoActualizado.id} (${documentoActualizado.nombre})`,
            fecha_inicio: new Date(),
            fecha_act: new Date()
          }
        });
      } catch (e) {
        console.error('Error al registrar actualización en bitácora:', e);
      }
    })();

    // añadir download_url si aplica
    let download_url = null;
    if (documentoActualizado.ruta && documentoActualizado.ruta.startsWith('uploads/')) {
      const host = req.get('host');
      const protocol = req.protocol;
      download_url = `${protocol}://${host}/${documentoActualizado.ruta}`;
    }

    return successResponse(res, { ...documentoActualizado, download_url }, 'Documento actualizado exitosamente');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al actualizar documento', 500, error.message);
  }
});

// DELETE /api/documentos/:id - Eliminar documento (autenticado)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const documentoExistente = await prisma.documentos.findUnique({
      where: { id: parseInt(id) }
    });

    if (!documentoExistente) {
      return errorResponse(res, 'Documento no encontrado', 404);
    }

    await prisma.documentos.delete({
      where: { id: parseInt(id) }
    });

    // registrar eliminación en bitácora (no bloquear la respuesta si falla)
    (async () => {
      try {
        await prisma.bitacora.create({
          data: {
            usuario_id: documentoExistente.usuarios_id || null,
            accion: 'eliminacion',
            descripcion: `Eliminó documento ${documentoExistente.id} (${documentoExistente.nombre})`,
            fecha_inicio: new Date(),
            fecha_act: new Date()
          }
        });
      } catch (e) {
        console.error('Error al registrar eliminación en bitácora:', e);
      }
    })();

    return successResponse(res, null, 'Documento eliminado exitosamente');
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al eliminar documento', 500, error.message);
  }
});

// POST /api/documentos/upload - Subir archivo y registrar en bitacora (autenticado)
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Archivo no proporcionado', 400);

    const { originalname, mimetype, filename, path: filePath, size } = req.file;
    const { usuarios_id, descripcion } = req.body;

    if (!usuarios_id) {
      // eliminar archivo si no hay usuario
      fs.unlinkSync(filePath);
      return errorResponse(res, 'usuarios_id es requerido', 400);
    }

    // crear registro en documentos y bitacora de forma segura
    let nuevoDocumento = null;
    try {
      nuevoDocumento = await prisma.documentos.create({
        data: {
          nombre: originalname,
          descripcion: descripcion || null,
          mime: mimetype,
          ruta: `uploads/${filename}`,
          usuarios_id: parseInt(usuarios_id),
          fecha_subida: new Date()
        }
      });

      // crear entrada en bitacora
      await prisma.bitacora.create({
        data: {
          usuario_id: parseInt(usuarios_id),
          accion: 'subida',
          descripcion: `Subió archivo ${originalname} (${size} bytes) -> ${nuevoDocumento.ruta}`,
          fecha_inicio: new Date(),
          fecha_act: new Date()
        }
      });

      // añadir download_url
      const host = req.get('host');
      const protocol = req.protocol;
      const download_url = `${protocol}://${host}/${nuevoDocumento.ruta}`;

      return successResponse(res, { ...nuevoDocumento, download_url }, 'Archivo subido y registrado', 201);
    } catch (err) {
      console.error('Error al crear documento/bitacora:', err);
      // intentar limpiar: borrar archivo físico
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { console.error('No se pudo borrar archivo tras fallo:', e); }
      // intentar borrar registro de documento si se creó
      try {
        if (nuevoDocumento && nuevoDocumento.id) {
          await prisma.documentos.delete({ where: { id: nuevoDocumento.id } });
        }
      } catch (e) {
        console.error('No se pudo borrar registro de documento tras fallo:', e);
      }

      return errorResponse(res, 'Error interno al registrar archivo', 500, err.message || err);
    }
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al subir archivo', 500, error.message);
  }
});

// Exportar router
module.exports = router;
