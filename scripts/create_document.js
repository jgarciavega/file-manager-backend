const fetch = require('node-fetch');

const BASE = process.env.BASE || 'http://localhost:4000/api';

async function parseApiData(res) {
  const json = await res.json().catch(() => null);
  if (!json) return null;
  return json.data ?? null;
}

async function getOrCreateUser() {
  const res = await fetch(`${BASE}/usuarios`);
  if (!res.ok) return null;
  const data = await parseApiData(res);

  // la API devuelve { data: { usuarios: [...], pagination } }
  if (data) {
    if (Array.isArray(data.usuarios) && data.usuarios.length > 0) return data.usuarios[0];
    if (Array.isArray(data)) return data[0];
  }

  // crear usuario si no hay ninguno
  const nuevo = {
    nombre: 'ScriptUsuario',
    apellidos: 'Auto',
    email: `script.user.${Date.now()}@local.test`,
    activo: true
  };

  const createRes = await fetch(`${BASE}/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevo)
  });

  if (!createRes.ok) {
    const txt = await createRes.text();
    throw new Error(`No se pudo crear usuario: ${createRes.status} ${txt}`);
  }

  const created = await createRes.json();
  return created.data ?? null;
}

async function createDocumento(usuario) {
  const payload = {
    nombre: `Documento de ${usuario.nombre}`,
    descripcion: 'Documento creado por script de prueba',
    mime: 'text/plain',
    ruta: `uploads/manual-${Date.now()}.txt`,
    usuarios_id: usuario.id
  };

  const res = await fetch(`${BASE}/documentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return { ok: res.ok, status: res.status, body: json };
  } catch (e) {
    return { ok: res.ok, status: res.status, body: text };
  }
}

(async () => {
  try {
    console.log('BASE:', BASE);
    const usuario = await getOrCreateUser();
    if (!usuario) {
      console.error('No se pudo obtener ni crear usuario. Asegúrate de que el servidor esté corriendo en', BASE);
      process.exit(1);
    }
    console.log('Usando usuario:', usuario.id, usuario.nombre || usuario.email);

    const resultado = await createDocumento(usuario);
    console.log('Resultado creación documento:', resultado.status, JSON.stringify(resultado.body, null, 2));
  } catch (err) {
    console.error('ERROR', err.message || err);
    process.exit(1);
  }
})();
