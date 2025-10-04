const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');

const prisma = new PrismaClient();

// GET /api/catalogs/cuadro_clasificacion
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const items = await prisma.cuadro_clasificacion.findMany({ skip: parseInt(skip), take: parseInt(limit), orderBy: { codigo: 'asc' } });
    const total = await prisma.cuadro_clasificacion.count();
    return successResponse(res, items, 'Cuadro de clasificación obtenido', 200);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error obteniendo cuadro de clasificación', 500, e.message);
  }
});

// GET by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.cuadro_clasificacion.findUnique({ where: { id: parseInt(id) } });
    if (!item) return errorResponse(res, 'No encontrado', 404);
    return successResponse(res, item);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error obteniendo registro', 500, e.message);
  }
});

// POST
router.post('/', async (req, res) => {
  try {
    const { codigo, titulo, descripcion } = req.body;
    if (!codigo) return errorResponse(res, 'codigo es requerido', 400);
    const exists = await prisma.cuadro_clasificacion.findFirst({ where: { codigo } });
    if (exists) return errorResponse(res, 'codigo ya existe', 400);
    const created = await prisma.cuadro_clasificacion.create({ data: { codigo, titulo, descripcion } });
    return successResponse(res, created, 'Creado', 201);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error creando registro', 500, e.message);
  }
});

// PUT
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const exists = await prisma.cuadro_clasificacion.findUnique({ where: { id: parseInt(id) } });
    if (!exists) return errorResponse(res, 'No encontrado', 404);
    const updated = await prisma.cuadro_clasificacion.update({ where: { id: parseInt(id) }, data });
    return successResponse(res, updated, 'Actualizado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error actualizando', 500, e.message);
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docsCount = await prisma.documentos.count({ where: { codigo_clasificacion_id: parseInt(id) } });
    if (docsCount > 0) return errorResponse(res, 'No se puede eliminar: tiene documentos asociados', 400);
    await prisma.cuadro_clasificacion.delete({ where: { id: parseInt(id) } });
    return successResponse(res, null, 'Eliminado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error eliminando', 500, e.message);
  }
});

module.exports = router;
