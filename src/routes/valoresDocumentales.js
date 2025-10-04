const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { successResponse, errorResponse } = require('../utils/responses');

const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const items = await prisma.valores_documentales.findMany({ skip: parseInt(skip), take: parseInt(limit), orderBy: { clave: 'asc' } });
    return successResponse(res, items);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error obteniendo valores documentales', 500, e.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.valores_documentales.findUnique({ where: { id: parseInt(req.params.id) } });
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
    const exists = await prisma.valores_documentales.findFirst({ where: { clave } });
    if (exists) return errorResponse(res, 'clave ya existe', 400);
    const created = await prisma.valores_documentales.create({ data: { clave, nombre, descripcion } });
    return successResponse(res, created, 'Creado', 201);
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error creando registro', 500, e.message);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.valores_documentales.findUnique({ where: { id } });
    if (!exists) return errorResponse(res, 'No encontrado', 404);
    const updated = await prisma.valores_documentales.update({ where: { id }, data: req.body });
    return successResponse(res, updated, 'Actualizado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error actualizando', 500, e.message);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const docsCount = await prisma.documentos.count({ where: { valor_documental_id: id } });
    if (docsCount > 0) return errorResponse(res, 'No se puede eliminar: tiene documentos asociados', 400);
    await prisma.valores_documentales.delete({ where: { id } });
    return successResponse(res, null, 'Eliminado');
  } catch (e) {
    console.error(e);
    return errorResponse(res, 'Error eliminando', 500, e.message);
  }
});

module.exports = router;
