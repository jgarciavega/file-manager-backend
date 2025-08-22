const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const users = [
  { nombre: 'Ana', apellidos: 'García', email: 'ana.garcia@example.com', password: 'secret' },
  { nombre: 'Luis', apellidos: 'Martínez', email: 'luis.martinez@example.com', password: 'secret' },
  { nombre: 'María', apellidos: 'Rodríguez', email: 'maria.rodriguez@example.com', password: 'secret' },
  { nombre: 'Carlos', apellidos: 'Pérez', email: 'carlos.perez@example.com', password: 'secret' },
  { nombre: 'Test', apellidos: 'User', email: 'test.user@example.com', password: 'secret' }
];

(async () => {
  try {
    console.log('Iniciando seed de usuarios...');
    let created = 0, updated = 0;
    for (const u of users) {
      // upsert para evitar errores por email único
      const res = await prisma.usuarios.upsert({
        where: { email: u.email },
        update: {
          nombre: u.nombre,
          apellidos: u.apellidos,
          password: u.password,
          activo: 1
        },
        create: {
          nombre: u.nombre,
          apellidos: u.apellidos,
          email: u.email,
          password: u.password,
          activo: 1
        }
      });
      if (res) {
        // si el registro se creó ahora, no hay forma directa de distinguir aquí, asumimos upsert como update when existed
        // contaremos como creado si el id es menor que 1000 and email new? Para simplicidad, solo contaremos todos como upserted
        updated++;
      }
    }
    console.log(`Seed completado. Upsert ejecutados: ${updated}`);
  } catch (e) {
    console.error('Error en seed:', e.message || e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
