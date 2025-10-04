const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');

const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const items = await prisma.destinos_finales.findMany({ orderBy: { clave: 'asc' } });
    return successResponse(res, items);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error obteniendo destinos finales', 500, e.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.destinos_finales.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!item) return errorResponse(res, 'No encontrado', 404);
    return successResponse(res, item);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error obteniendo registro', 500, e.message);
  }
});

router.post('/', async (req, res) => {
  try {
    const { clave, nombre, descripcion } = req.body;
    if (!clave) return errorResponse(res, 'clave es requerida', 400);
    const exists = await prisma.destinos_finales.findFirst({ where: { clave } });
    if (exists) return errorResponse(res, 'clave ya existe', 400);
    const created = await prisma.destinos_finales.create({ data: { clave, nombre, descripcion } });
    return successResponse(res, created, 'Creado', 201);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error creando registro', 500, e.message);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.destinos_finales.findUnique({ where: { id } });
    if (!exists) return errorResponse(res, 'No encontrado', 404);
    const updated = await prisma.destinos_finales.update({ where: { id }, data: req.body });
    return successResponse(res, updated, 'Actualizado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error actualizando', 500, e.message);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const docsCount = await prisma.documentos.count({ where: { destino_final_id: id } });
    if (docsCount > 0) return errorResponse(res, 'No se puede eliminar: tiene documentos asociados', 400);
    await prisma.destinos_finales.delete({ where: { id } });
    return successResponse(res, null, 'Eliminado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error eliminando', 500, e.message);
  }
});

module.exports = router;
