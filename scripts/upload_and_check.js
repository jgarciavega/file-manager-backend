const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const FormData = require('form-data');

const BASE = process.env.BASE || 'http://localhost:4000/api';

async function getAnyUser() {
  const res = await fetch(`${BASE}/usuarios`);
  if (!res.ok) throw new Error('No se pudieron listar usuarios');
  const json = await res.json();
  // Puede devolver { data: { usuarios: [...], pagination } }
  let u = null;
  if (json && json.data) {
    if (Array.isArray(json.data.usuarios) && json.data.usuarios.length) u = json.data.usuarios[0];
    else if (Array.isArray(json.data)) u = json.data[0];
  }
  return u;
}

async function uploadFile(usuario) {
  const filePath = path.join(__dirname, '..', 'README.md');
  if (!fs.existsSync(filePath)) throw new Error('No existe README.md en el proyecto para subir como prueba');

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('usuarios_id', String(usuario.id));
  form.append('descripcion', 'Prueba de upload desde script');

  const res = await fetch(`${BASE}/documentos/upload`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders()
  });

  const txt = await res.text();
  try { return { ok: res.ok, status: res.status, body: JSON.parse(txt) }; } catch (e) { return { ok: res.ok, status: res.status, body: txt }; }
}

async function checkEntries(usuario) {
  const docsRes = await fetch(`${BASE}/documentos?usuario_id=${usuario.id}`);
  const docsJson = await docsRes.json();

  const bitRes = await fetch(`${BASE}/bitacora/usuario/${usuario.id}`);
  const bitJson = await bitRes.json();

  const documentos = (docsJson && docsJson.data && docsJson.data.documentos) ? docsJson.data.documentos : (docsJson.data ?? []);
  let bitacora = [];
  if (bitJson && bitJson.data) {
    if (Array.isArray(bitJson.data.registros)) bitacora = bitJson.data.registros;
    else if (Array.isArray(bitJson.data)) bitacora = bitJson.data;
  }

  return { documentos, bitacora };
}

(async () => {
  try {
    console.log('BASE:', BASE);
    const usuario = await getAnyUser();
    if (!usuario) throw new Error('No hay usuarios en la API. Ejecuta seed o crea uno.');
    console.log('Usuario para prueba:', usuario.id, usuario.nombre || usuario.email);

    const uploadResult = await uploadFile(usuario);
    console.log('Upload result:', uploadResult.status, JSON.stringify(uploadResult.body, null, 2));

    const check = await checkEntries(usuario);
    console.log('Documentos del usuario (count):', Array.isArray(check.documentos) ? check.documentos.length : 'N/A');
    console.log('Bitacora del usuario (count):', Array.isArray(check.bitacora) ? check.bitacora.length : 'N/A');
  } catch (err) {
    console.error('ERROR:', err.message || err);
    process.exit(1);
  }
})();
