const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordPlain = 'Password123!';
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(passwordPlain, salt);

  // Roles que necesitamos según el UI
  const roleNames = ['admin', 'capturista', 'revisor', 'user'];
  const rolesMap = {};
  for (const rn of roleNames) {
    const r = await prisma.roles.upsert({
      where: { name: rn },
      update: {},
      create: { name: rn, descripcion: rn }
    });
    rolesMap[rn] = r;
  }

  const users = [
    { nombre: 'Jorge', apellidos: 'García Vega', email: 'jorge.garcia@apibcs.com.mx', role: 'admin', activo: 1 },
    { nombre: 'Annel', apellidos: 'Torres', email: 'annel@apibcs.com.mx', role: 'capturista', activo: 1 },
    { nombre: 'Julio', apellidos: 'Rubio', email: 'jrubio@apibcs.com.mx', role: 'revisor', activo: 1 },
    { nombre: 'Admin', apellidos: 'Test', email: 'admin@test.com', role: 'admin', activo: 1 },
    { nombre: 'Usuario', apellidos: 'Demo', email: 'user@demo.com', role: 'user', activo: 0 }
  ];

  for (const u of users) {
    const up = await prisma.usuarios.upsert({
      where: { email: u.email },
      update: {
        nombre: u.nombre,
        apellidos: u.apellidos,
        activo: u.activo,
        password: hashed
      },
      create: {
        nombre: u.nombre,
        apellidos: u.apellidos,
        email: u.email,
        password: hashed,
        activo: u.activo
      }
    });

    const role = rolesMap[u.role];
    if (role) {
      // upsert en tabla join
      await prisma.usuario_roles.upsert({
        where: { usuario_id_role_id: { usuario_id: up.id, role_id: role.id } },
        update: {},
        create: { usuario_id: up.id, role_id: role.id }
      });
    }

    console.log(`Usuario upserted: ${up.email} (id=${up.id}) -> role=${u.role}`);
  }

  console.log('Seed usuarios (UI) completado. Password por defecto:', passwordPlain);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
