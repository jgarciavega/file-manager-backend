const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const documentos = await prisma.documentos.findMany({ orderBy: { id: 'desc' }, take: 10 });
    const bitacora = await prisma.bitacora.findMany({ orderBy: { id: 'desc' }, take: 10 });
    console.log(JSON.stringify({ documentos, bitacora }, null, 2));
  } catch (e) {
    console.error('ERROR', e.message || e);
    process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
})();
