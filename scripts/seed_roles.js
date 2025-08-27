const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Crear roles base
  const roles = [
    { name: 'admin', descripcion: 'Administrador del sistema' },
    { name: 'editor', descripcion: 'Puede crear/editar documentos' },
    { name: 'viewer', descripcion: 'Solo lectura' }
  ];

  for (const r of roles) {
    await prisma.roles.upsert({
      where: { name: r.name },
      update: {},
      create: r
    });
  }

  console.log('Roles seed completado');

  // Opcional: asignar rol admin al primer usuario si existe
  const primerUsuario = await prisma.usuarios.findFirst();
  if (primerUsuario) {
    const adminRole = await prisma.roles.findUnique({ where: { name: 'admin' } });
    if (adminRole) {
      await prisma.usuario_roles.upsert({
        where: { usuario_id_role_id: { usuario_id: primerUsuario.id, role_id: adminRole.id } },
        update: {},
        create: { usuario_id: primerUsuario.id, role_id: adminRole.id }
      });
      console.log('Asignado role admin al usuario id=', primerUsuario.id);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
