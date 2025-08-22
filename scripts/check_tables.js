const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const p = new PrismaClient();
  try{
    const res = await p.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
    console.log('tables:', res.map(r=>r.name));
    const bit = await p.$queryRaw`SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='bitacora'`;
    console.log('bitacora exists:', bit[0] && (bit[0].c>0));
  }catch(e){
    console.error('ERR', e.message||e);
  }finally{await p.$disconnect();}
})();
