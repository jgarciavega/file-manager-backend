const express = require("express");
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/periodos
// Body esperado: { periodo: string, fecha_inicio: ISOString | Date, fecha_final: ISOString | Date, activo: boolean }
router.post('/', async (req, res) => {
	try {
		const { periodo, fecha_inicio, fecha_final, activo } = req.body || {};
		if (!periodo) return res.status(400).json({ error: 'periodo es requerido' });

		const start = fecha_inicio ? new Date(fecha_inicio) : null;
		const end = fecha_final ? new Date(fecha_final) : null;

		if (start && end && start > end) {
			return res.status(400).json({ error: 'fecha_inicio no puede ser mayor que fecha_final' });
		}

		const exists = await prisma.periodos.findFirst({ where: { periodo } });
		if (exists) return res.status(409).json({ error: 'Periodo ya existe' });

		const created = await prisma.periodos.create({ data: { periodo, fecha_inicio: start, fecha_final: end, activo: !!activo } });
		return res.status(201).json(created);
	} catch (e) {
		console.error('Error creando periodo:', e);
		return res.status(500).json({ error: 'Error interno' });
	}
});

module.exports = router;
