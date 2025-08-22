const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db', { readonly: true });
try{
  const docs = db.prepare('SELECT id,nombre,ruta,fecha_subida FROM documentos ORDER BY id DESC LIMIT 10').all();
  const bits = db.prepare('SELECT id,usuario_id,accion,detalles,fecha_inicio FROM bitacora ORDER BY id DESC LIMIT 10').all();
  console.log(JSON.stringify({ documentos: docs, bitacora: bits }, null, 2));
}catch(e){
  console.error('ERR', e.message||e);
}finally{db.close();}
