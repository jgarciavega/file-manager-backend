const fetch = require('node-fetch');
const fs = require('fs');
const FormData = require('form-data');

(async ()=>{
  try{
    // Crear usuario
    const resp = await fetch('http://localhost:4000/api/usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'PruebaLocal', apellidos: 'User', email: 'prueba_local@example.com', password: 'secret' })
    });
    const user = await resp.json();
    console.log('Usuario creado:', user);
    const usuario_id = user.data && user.data.id ? user.data.id : 1;

    // Subir archivo README.md
    const form = new FormData();
    form.append('file', fs.createReadStream('README.md'));
    form.append('usuarios_id', usuario_id);
    form.append('descripcion', 'Prueba automática desde script');

    const uploadResp = await fetch('http://localhost:4000/api/documentos/upload', {
      method: 'POST', headers: form.getHeaders(), body: form
    });
    const uploadResJson = await uploadResp.json();
    console.log('Upload response:', uploadResJson);
  }catch(err){
    console.error('ERROR', err.message || err);
    process.exitCode = 2;
  }
})();
