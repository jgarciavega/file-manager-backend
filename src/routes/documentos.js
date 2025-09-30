const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');
const { verifyToken } = require('../middleware/auth');
const { loadUserRoles, requireAnyRole, requireRole } = require('../middleware/roles');

const prisma = new PrismaClient();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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

// helper: calcular checksum SHA-256 de un archivo por streaming
async function computeFileChecksum(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(filePath);
    rs.on('data', (chunk) => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
    rs.on('error', (err) => reject(err));
  });
}

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
      // ahora solo aceptamos FK *_id para catálogos
      codigo_clasificacion_id,
      valor_documental_id,
      plazo_conservacion_id,
      destino_final_id,
      soporte_id
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
    // catálogos: ahora sólo ids
    if (!codigo_clasificacion_id) missing.push('codigo_clasificacion_id');
    if (!valor_documental_id) missing.push('valor_documental_id');
    if (!plazo_conservacion_id) missing.push('plazo_conservacion_id');
    if (!destino_final_id) missing.push('destino_final_id');
    if (!soporte_id) missing.push('soporte_id');

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

    // Validar catálogos por id (todos deben existir)
    const codigoClasId = parseInt(codigo_clasificacion_id);
    const fCodigo = await prisma.cuadro_clasificacion.findUnique({ where: { id: codigoClasId } });
    if (!fCodigo) return errorResponse(res, 'Cuadro de clasificación (codigo_clasificacion_id) no encontrado', 404);

    const valorDocId = parseInt(valor_documental_id);
    const fValor = await prisma.valores_documentales.findUnique({ where: { id: valorDocId } });
    if (!fValor) return errorResponse(res, 'Valor documental (valor_documental_id) no encontrado', 404);

    const plazoId = parseInt(plazo_conservacion_id);
    const fPlazo = await prisma.plazos_conservacion.findUnique({ where: { id: plazoId } });
    if (!fPlazo) return errorResponse(res, 'Plazo de conservación (plazo_conservacion_id) no encontrado', 404);

    const destinoId = parseInt(destino_final_id);
    const fDestino = await prisma.destinos_finales.findUnique({ where: { id: destinoId } });
    if (!fDestino) return errorResponse(res, 'Destino final (destino_final_id) no encontrado', 404);

    const soporteIdVal = parseInt(soporte_id);
    const fSoporte = await prisma.soportes_documentales.findUnique({ where: { id: soporteIdVal } });
    if (!fSoporte) return errorResponse(res, 'Soporte documental (soporte_id) no encontrado', 404);

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
          codigo_clasificacion_id: codigoClasId,
          valor_documental_id: valorDocId,
          plazo_conservacion_id: plazoId,
          destino_final_id: destinoId,
          soporte_id: soporteIdVal,
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
      valor_documental_id,
      plazo_conservacion_id,
      destino_final_id,
      soporte_id
    } = req.body;

    // Campos obligatorios
    const missing = [];
    if (!usuarios_id) missing.push('usuarios_id');
    if (!tipos_documentos_id) missing.push('tipos_documentos_id');
    if (!departamentos_id) missing.push('departamentos_id');
    if (!periodos_id) missing.push('periodos_id');
    if (!codigo_clasificacion_id) missing.push('codigo_clasificacion_id');
    if (!valor_documental_id) missing.push('valor_documental_id');
    if (!plazo_conservacion_id) missing.push('plazo_conservacion_id');
    if (!destino_final_id) missing.push('destino_final_id');
    if (!soporte_id) missing.push('soporte_id');

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

    // Validar catálogos por id
    const codigoClasId = parseInt(codigo_clasificacion_id);
    const fCodigo = await prisma.cuadro_clasificacion.findUnique({ where: { id: codigoClasId } });
    if (!fCodigo) { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}; return errorResponse(res, 'Cuadro de clasificación (codigo_clasificacion_id) no encontrado', 404); }

    const valorDocId = parseInt(valor_documental_id);
    const fValor = await prisma.valores_documentales.findUnique({ where: { id: valorDocId } });
    if (!fValor) { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}; return errorResponse(res, 'Valor documental (valor_documental_id) no encontrado', 404); }

    const plazoId = parseInt(plazo_conservacion_id);
    const fPlazo = await prisma.plazos_conservacion.findUnique({ where: { id: plazoId } });
    if (!fPlazo) { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}; return errorResponse(res, 'Plazo de conservación (plazo_conservacion_id) no encontrado', 404); }

    const destinoId = parseInt(destino_final_id);
    const fDestino = await prisma.destinos_finales.findUnique({ where: { id: destinoId } });
    if (!fDestino) { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}; return errorResponse(res, 'Destino final (destino_final_id) no encontrado', 404); }

    const soporteIdVal = parseInt(soporte_id);
    const fSoporte = await prisma.soportes_documentales.findUnique({ where: { id: soporteIdVal } });
    if (!fSoporte) { try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e){}; return errorResponse(res, 'Soporte documental (soporte_id) no encontrado', 404); }

    // crear registro en documentos y bitacora de forma segura
    let nuevoDocumento = null;
    try {
      // calcular checksum antes de insertar en la DB
      let checksum = null;
      try {
        checksum = await computeFileChecksum(filePath);
      } catch (e) {
        console.error('Error al calcular checksum:', e);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(err){}
        return errorResponse(res, 'Error al calcular checksum del archivo', 500, e.message || e);
      }
      // generar campos por defecto/derivados para que la respuesta los incluya
      const fecha_subida = new Date();
      const fecha_creacion = fecha_subida; // mismo valor por defecto
  // nivel de acceso: default PUBLICO
  const nivel_acceso = 'PUBLICO';
      // numero_expediente: EXP-YYYY-XXXX (XXXX = timestamp suffix)
      const numero_expediente = `EXP-${fecha_subida.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const serie = fCodigo && fCodigo.codigo ? `SER-${fCodigo.codigo}` : 'SER-000';
      const subserie = fCodigo && fCodigo.codigo ? `SUB-${String(fCodigo.codigo).slice(0,3)}` : 'SUB-000';
      const folio = String(Date.now());
      const procedencia = 'upload';
      const estado_vigencia = 'VIGENTE';
      // Usar transacción para insertar documento y bitacora atomically
      const result = await prisma.$transaction(async (tx) => {
        const doc = await tx.documentos.create({
          data: {
            nombre: originalname,
            descripcion: descripcion || null,
            mime: mimetype,
            ruta: `uploads/${filename}`,
            file_key: filename,
            checksum: checksum,
            size: size,
            tipos_documentos_id: parseInt(tipos_documentos_id),
            usuarios_id: parseInt(usuarios_id),
            departamentos_id: parseInt(departamentos_id),
            periodos_id: parseInt(periodos_id),
            fecha_creacion: fecha_creacion,
            fecha_subida: fecha_subida,
            nivel_acceso: nivel_acceso,
            numero_expediente: numero_expediente,
            serie: serie,
            subserie: subserie,
            folio: folio,
            // tipo_documento_text eliminado: se usa FK tipos_documentos_id
            procedencia: procedencia,
            estado_vigencia: estado_vigencia,
            codigo_clasificacion_id: codigoClasId,
            valor_documental_id: valorDocId,
            plazo_conservacion_id: plazoId,
            destino_final_id: destinoId,
            soporte_id: soporteIdVal
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
