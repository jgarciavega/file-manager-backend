const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');

const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const items = await prisma.plazos_conservacion.findMany({ orderBy: { clave: 'asc' } });
    return successResponse(res, items);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error obteniendo plazos de conservación', 500, e.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.plazos_conservacion.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!item) return errorResponse(res, 'No encontrado', 404);
    return successResponse(res, item);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error obteniendo registro', 500, e.message);
  }
});

router.post('/', async (req, res) => {
  try {
    const { clave, descripcion } = req.body;
    if (!clave) return errorResponse(res, 'clave es requerida', 400);
    const exists = await prisma.plazos_conservacion.findFirst({ where: { clave } });
    if (exists) return errorResponse(res, 'clave ya existe', 400);
    const created = await prisma.plazos_conservacion.create({ data: { clave, descripcion } });
    return successResponse(res, created, 'Creado', 201);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error creando registro', 500, e.message);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.plazos_conservacion.findUnique({ where: { id } });
    if (!exists) return errorResponse(res, 'No encontrado', 404);
    const updated = await prisma.plazos_conservacion.update({ where: { id }, data: req.body });
    return successResponse(res, updated, 'Actualizado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error actualizando', 500, e.message);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const docsCount = await prisma.documentos.count({ where: { plazo_conservacion_id: id } });
    if (docsCount > 0) return errorResponse(res, 'No se puede eliminar: tiene documentos asociados', 400);
    await prisma.plazos_conservacion.delete({ where: { id } });
    return successResponse(res, null, 'Eliminado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error eliminando', 500, e.message);
  }
});

module.exports = router;
