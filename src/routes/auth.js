const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const multipart = multer();
const { successResponse, errorResponse } = require('../utils/responses');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const prisma = new PrismaClient();

// POST /api/auth/login
router.post('/login', multipart.none(), async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return errorResponse(res, 'Email y password son requeridos', 400);

    const user = await prisma.usuarios.findFirst({ where: { email: String(email).toLowerCase() } });
    if (!user) return errorResponse(res, 'Credenciales inválidas', 401);

    const valid = await bcrypt.compare(String(password), user.password || '');
    if (!valid) return errorResponse(res, 'Credenciales inválidas', 401);

    const secret = process.env.JWT_SECRET;
    if (!secret) return errorResponse(res, 'Server misconfigured: JWT_SECRET not set', 500);

    const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: process.env.JWT_EXPIRES || '8h' });

    return successResponse(res, { token, user: { id: user.id, nombre: user.nombre, email: user.email, role_id: user.role_id, departamentos_id: user.departamentos_id } }, 'Autenticación exitosa');
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Error en login', 500, err.message);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const id = req.userId;
    if (!id) return errorResponse(res, 'Token válido pero sin user id', 400);

    const user = await prisma.usuarios.findUnique({ where: { id }, select: { id: true, nombre: true, apellidos: true, email: true, activo: true, role_id: true, departamentos_id: true } });
    if (!user) return errorResponse(res, 'Usuario no encontrado', 404);

    return successResponse(res, user);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Error obteniendo usuario', 500, err.message);
  }
});

module.exports = router;
