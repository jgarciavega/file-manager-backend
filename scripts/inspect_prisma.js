const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    console.log('PrismaClient props:', Object.keys(p).sort());
    console.log('Has documentos:', typeof p.documentos !== 'undefined');
    console.log('Has bitacora:', typeof p.bitacora !== 'undefined');
  } finally {
    await p.$disconnect();
  }
})();
