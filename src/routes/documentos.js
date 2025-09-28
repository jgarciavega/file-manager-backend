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
      usuarios_id,
      tipos_documentos_id,
      departamentos_id,
      periodos_id,
      // catálogos: puede llegar como *_id o como clave/string
      codigo_clasificacion_id,
      codigo_clasificacion,
      valor_documental_id,
      valor_documental,
      plazo_conservacion_id,
      plazo_conservacion,
      destino_final_id,
      destino_final,
      soporte_id,
      soporte
    } = req.body;

    // Campos obligatorios: todos los metadatos
    const missing = [];
    if (!nombre) missing.push('nombre');
    if (!descripcion) missing.push('descripcion');
    if (!mime) missing.push('mime');
    if (!ruta) missing.push('ruta');
    if (!usuarios_id) missing.push('usuarios_id');
    if (!tipos_documentos_id) missing.push('tipos_documentos_id');
    if (!departamentos_id) missing.push('departamentos_id');
    if (!periodos_id) missing.push('periodos_id');
    // catálogos: aceptamos id o campo legacy/clave
    if (!codigo_clasificacion_id && !codigo_clasificacion) missing.push('codigo_clasificacion_id|codigo_clasificacion');
    if (!valor_documental_id && !valor_documental) missing.push('valor_documental_id|valor_documental');
    if (!plazo_conservacion_id && !plazo_conservacion) missing.push('plazo_conservacion_id|plazo_conservacion');
    if (!destino_final_id && !destino_final) missing.push('destino_final_id|destino_final');
    if (!soporte_id && !soporte) missing.push('soporte_id|soporte');

    if (missing.length) return errorResponse(res, `Faltan campos obligatorios: ${missing.join(', ')}`, 400);

    // Validaciones adicionales
    if (typeof nombre !== 'string' || nombre.length < 3 || nombre.length > 255) {
      return errorResponse(res, 'Nombre inválido (3-255 caracteres)', 400);
    }

    if (ruta && ruta.startsWith('uploads/')) {
      const fullPath = path.join(__dirname, '..', '..', ruta);
      if (!fs.existsSync(fullPath)) return errorResponse(res, 'El archivo indicado en ruta no existe en servidor', 400);
    }

    // Validar existencia de referencias en DB
    const usuario = await prisma.usuarios.findUnique({ where: { id: parseInt(usuarios_id) } });
    if (!usuario) return errorResponse(res, 'Usuario (usuarios_id) no encontrado', 404);

    const tipoDoc = await prisma.tipos_documentos.findUnique({ where: { id: parseInt(tipos_documentos_id) } });
    if (!tipoDoc) return errorResponse(res, 'Tipo de documento (tipos_documentos_id) no encontrado', 404);

    const dept = await prisma.departamentos.findUnique({ where: { id: parseInt(departamentos_id) } });
    if (!dept) return errorResponse(res, 'Departamento (departamentos_id) no encontrado', 404);

    const periodo = await prisma.periodos.findUnique({ where: { id: parseInt(periodos_id) } });
    if (!periodo) return errorResponse(res, 'Periodo (periodos_id) no encontrado', 404);

    // Resolver/validar catálogos: cuadro_clasificacion (codigo), valores_documentales (clave), plazos, destinos, soportes
    let codigoClasId = codigo_clasificacion_id ? parseInt(codigo_clasificacion_id) : null;
    if (!codigoClasId && codigo_clasificacion) {
      const found = await prisma.cuadro_clasificacion.findFirst({ where: { codigo: codigo_clasificacion } });
      if (!found) return errorResponse(res, 'Cuadro de clasificación no encontrado por codigo', 404);
      codigoClasId = found.id;
    } else if (codigoClasId) {
      const f = await prisma.cuadro_clasificacion.findUnique({ where: { id: codigoClasId } });
      if (!f) return errorResponse(res, 'Cuadro de clasificación (id) no encontrado', 404);
    }

    let valorDocId = valor_documental_id ? parseInt(valor_documental_id) : null;
    if (!valorDocId && valor_documental) {
      const found = await prisma.valores_documentales.findFirst({ where: { clave: valor_documental } });
      if (!found) return errorResponse(res, 'Valor documental no encontrado por clave', 404);
      valorDocId = found.id;
    } else if (valorDocId) {
      const f = await prisma.valores_documentales.findUnique({ where: { id: valorDocId } });
      if (!f) return errorResponse(res, 'Valor documental (id) no encontrado', 404);
    }

    let plazoId = plazo_conservacion_id ? parseInt(plazo_conservacion_id) : null;
    if (!plazoId && plazo_conservacion) {
      const found = await prisma.plazos_conservacion.findFirst({ where: { clave: plazo_conservacion } });
      if (!found) return errorResponse(res, 'Plazo de conservación no encontrado por clave', 404);
      plazoId = found.id;
    } else if (plazoId) {
      const f = await prisma.plazos_conservacion.findUnique({ where: { id: plazoId } });
      if (!f) return errorResponse(res, 'Plazo de conservación (id) no encontrado', 404);
    }

    let destinoId = destino_final_id ? parseInt(destino_final_id) : null;
    if (!destinoId && destino_final) {
      const found = await prisma.destinos_finales.findFirst({ where: { clave: destino_final } });
      if (!found) return errorResponse(res, 'Destino final no encontrado por clave', 404);
      destinoId = found.id;
    } else if (destinoId) {
      const f = await prisma.destinos_finales.findUnique({ where: { id: destinoId } });
      if (!f) return errorResponse(res, 'Destino final (id) no encontrado', 404);
    }

    // placeholder removed; parse soporte id
    let soporteIdVal = soporte_id ? parseInt(soporte_id) : null;
    if (!soporteIdVal && soporte) {
      const found = await prisma.soportes_documentales.findFirst({ where: { clave: soporte } });
      if (!found) return errorResponse(res, 'Soporte documental no encontrado por clave', 404);
      soporteIdVal = found.id;
    } else if (soporteIdVal) {
      const f = await prisma.soportes_documentales.findUnique({ where: { id: soporteIdVal } }).catch(() => null);
      if (!f) {
        // try to find by id normally
        const f2 = await prisma.soportes_documentales.findUnique({ where: { id: soporteIdVal } });
        if (!f2) return errorResponse(res, 'Soporte documental (id) no encontrado', 404);
      }
    }

    // Note: earlier code used enum Soporte; we accept mapping via catalog table for normalized data

    // crear documento y bitacora en una transacción para asegurar atomicidad
    const nuevoDocumento = await prisma.$transaction(async (tx) => {
      const doc = await tx.documentos.create({
        data: {
          nombre,
          descripcion,
          mime,
          ruta,
          usuarios_id: parseInt(usuarios_id),
          tipos_documentos_id: parseInt(tipos_documentos_id),
          departamentos_id: parseInt(departamentos_id),
          periodos_id: parseInt(periodos_id),
          codigo_clasificacion_id: codigoClasId || null,
          valor_documental_id: valorDocId || null,
          plazo_conservacion_id: plazoId || null,
          destino_final_id: destinoId || null,
          soporte_id: soporteIdVal || null,
          fecha_subida: new Date()
        },
        include: {
          usuarios: {
            select: { id: true, nombre: true, apellidos: true }
          }
        }
      });

      await tx.bitacora.create({
        data: {
          usuario_id: parseInt(usuarios_id) || null,
          accion: 'creacion',
          descripcion: `Creó documento ${doc.nombre} -> ${doc.ruta}`,
          fecha_inicio: new Date(),
          fecha_act: new Date()
        }
      });

      return doc;
    });

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
    const {
      usuarios_id,
      descripcion,
      tipos_documentos_id,
      departamentos_id,
      periodos_id,
      codigo_clasificacion_id,
      codigo_clasificacion,
      valor_documental_id,
      valor_documental,
      plazo_conservacion_id,
      plazo_conservacion,
      destino_final_id,
      destino_final,
      soporte_id,
      soporte
    } = req.body;

    // Campos obligatorios
    const missing = [];
    if (!usuarios_id) missing.push('usuarios_id');
    if (!tipos_documentos_id) missing.push('tipos_documentos_id');
    if (!departamentos_id) missing.push('departamentos_id');
    if (!periodos_id) missing.push('periodos_id');
    if (!codigo_clasificacion_id && !codigo_clasificacion) missing.push('codigo_clasificacion_id|codigo_clasificacion');
    if (!valor_documental_id && !valor_documental) missing.push('valor_documental_id|valor_documental');
    if (!plazo_conservacion_id && !plazo_conservacion) missing.push('plazo_conservacion_id|plazo_conservacion');
    if (!destino_final_id && !destino_final) missing.push('destino_final_id|destino_final');
    if (!soporte_id && !soporte) missing.push('soporte_id|soporte');

    if (missing.length) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
      return errorResponse(res, `Faltan campos obligatorios: ${missing.join(', ')}`, 400);
    }

    // Validar referencias en BD (usuarios, tipos, departamentos, periodos)
    const usuario = await prisma.usuarios.findUnique({ where: { id: parseInt(usuarios_id) } });
    if (!usuario) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
      return errorResponse(res, 'Usuario (usuarios_id) no encontrado', 404);
    }
    const tipoDoc = await prisma.tipos_documentos.findUnique({ where: { id: parseInt(tipos_documentos_id) } });
    if (!tipoDoc) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
      return errorResponse(res, 'Tipo de documento (tipos_documentos_id) no encontrado', 404);
    }
    const dept = await prisma.departamentos.findUnique({ where: { id: parseInt(departamentos_id) } });
    if (!dept) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
      return errorResponse(res, 'Departamento (departamentos_id) no encontrado', 404);
    }
    const periodo = await prisma.periodos.findUnique({ where: { id: parseInt(periodos_id) } });
    if (!periodo) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
      return errorResponse(res, 'Periodo (periodos_id) no encontrado', 404);
    }

    // Resolver catálogos (similar a POST /api/documentos)
    let codigoClasId = codigo_clasificacion_id ? parseInt(codigo_clasificacion_id) : null;
    if (!codigoClasId && codigo_clasificacion) {
      const found = await prisma.cuadro_clasificacion.findFirst({ where: { codigo: codigo_clasificacion } });
      if (!found) {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
        return errorResponse(res, 'Cuadro de clasificación no encontrado por codigo', 404);
      }
      codigoClasId = found.id;
    }

    let valorDocId = valor_documental_id ? parseInt(valor_documental_id) : null;
    if (!valorDocId && valor_documental) {
      const found = await prisma.valores_documentales.findFirst({ where: { clave: valor_documental } });
      if (!found) {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
        return errorResponse(res, 'Valor documental no encontrado por clave', 404);
      }
      valorDocId = found.id;
    }

    let plazoId = plazo_conservacion_id ? parseInt(plazo_conservacion_id) : null;
    if (!plazoId && plazo_conservacion) {
      const found = await prisma.plazos_conservacion.findFirst({ where: { clave: plazo_conservacion } });
      if (!found) {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
        return errorResponse(res, 'Plazo de conservación no encontrado por clave', 404);
      }
      plazoId = found.id;
    }

    let destinoId = destino_final_id ? parseInt(destino_final_id) : null;
    if (!destinoId && destino_final) {
      const found = await prisma.destinos_finales.findFirst({ where: { clave: destino_final } });
      if (!found) {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
        return errorResponse(res, 'Destino final no encontrado por clave', 404);
      }
      destinoId = found.id;
    }

    let soporteIdVal = soporte_id ? parseInt(soporte_id) : null;
    if (!soporteIdVal && soporte) {
      const found = await prisma.soportes_documentales.findFirst({ where: { clave: soporte } });
      if (!found) {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}
        return errorResponse(res, 'Soporte documental no encontrado por clave', 404);
      }
      soporteIdVal = found.id;
    }

    // crear registro en documentos y bitacora de forma segura
    let nuevoDocumento = null;
    try {
      // Usar transacción para insertar documento y bitacora atomically
      const result = await prisma.$transaction(async (tx) => {
        const doc = await tx.documentos.create({
          data: {
            nombre: originalname,
            descripcion: descripcion || null,
            mime: mimetype,
            ruta: `uploads/${filename}`,
            file_key: filename,
            size: size,
            tipos_documentos_id: parseInt(tipos_documentos_id),
            usuarios_id: parseInt(usuarios_id),
            departamentos_id: parseInt(departamentos_id),
            periodos_id: parseInt(periodos_id),
            codigo_clasificacion_id: codigoClasId || null,
            valor_documental_id: valorDocId || null,
            plazo_conservacion_id: plazoId || null,
            destino_final_id: destinoId || null,
            soporte_id: soporteIdVal || null,
            fecha_subida: new Date()
          }
        });

        await tx.bitacora.create({
          data: {
            usuario_id: parseInt(usuarios_id),
            accion: 'subida',
            descripcion: `Subió archivo ${originalname} (${size} bytes) -> ${doc.ruta}`,
            fecha_inicio: new Date(),
            fecha_act: new Date()
          }
        });

        return doc;
      });

      nuevoDocumento = result;

      // añadir download_url
      const host = req.get('host');
      const protocol = req.protocol;
      const download_url = `${protocol}://${host}/${nuevoDocumento.ruta}`;

      return successResponse(res, { ...nuevoDocumento, download_url }, 'Archivo subido y registrado', 201);
    } catch (err) {
      console.error('Error al crear documento/bitacora en transacción:', err);
      // intentar limpiar: borrar archivo físico
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { console.error('No se pudo borrar archivo tras fallo:', e); }
      return errorResponse(res, 'Error interno al registrar archivo (transacción revertida)', 500, err.message || err);
    }
  } catch (error) {
    console.error(error);
    return errorResponse(res, 'Error al subir archivo', 500, error.message);
  }
});

// Exportar router
module.exports = router;
