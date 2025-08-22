const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');

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

// límites y filtro MIME
const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'text/plain',
  'text/markdown'
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido'));
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
    
    const documento = await prisma.documentos.findUnique({
      where: { id: parseInt(id) },
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

// POST /api/documentos - Crear nuevo documento
router.post('/', async (req, res) => {
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
            detalles: `Creó documento ${nuevoDocumento.nombre} -> ${nuevoDocumento.ruta}`
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

// PUT /api/documentos/:id - Actualizar documento
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, mime, ruta } = req.body;

  const documentoExistente = await prisma.documentos.findUnique({
      where: { id: parseInt(id) }
    });

    if (!documentoExistente) {
      return errorResponse(res, 'Documento no encontrado', 404);
    }

    const documentoActualizado = await prisma.documentos.update({
      where: { id: parseInt(id) },
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
            detalles: `Actualizó documento ${documentoActualizado.id} (${documentoActualizado.nombre})`
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

// DELETE /api/documentos/:id - Eliminar documento
router.delete('/:id', async (req, res) => {
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
            detalles: `Eliminó documento ${documentoExistente.id} (${documentoExistente.nombre})`
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

module.exports = router;

// POST /api/documentos/upload - Subir archivo y registrar en bitacora
router.post('/upload', upload.single('file'), async (req, res) => {
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
          detalles: `Subió archivo ${originalname} (${size} bytes) -> ${nuevoDocumento.ruta}`
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
