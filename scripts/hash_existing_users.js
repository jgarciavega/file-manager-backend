const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

(async () => {
  try {
    const users = await prisma.usuarios.findMany();
    console.log('Usuarios encontrados:', users.length);
    let updated = 0;
    for (const u of users) {
      // si password es null o parece no estar hasheada (longitud corta), actualizar
      if (!u.password || u.password.length < 20) {
        const newPass = 'changeMe123';
        const hash = await bcrypt.hash(newPass, 10);
        await prisma.usuarios.update({ where: { id: u.id }, data: { password: hash } });
        updated++;
        console.log(`Usuario ${u.id} actualizado con contraseña de prueba.`);
      }
    }
    console.log('Actualizaciones realizadas:', updated);
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err);
    process.exit(1);
  }
})();
