const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Usuarios prioritarios (incrustados aquí; antes estaban en seed_users_data.js)
const seedUsers = [

  { nombre: 'Jorge', apellidos: 'Garcia Vega', email: 'jorge.garcia@apibcs.com.mx', password: '123456' },
  { nombre: 'Ana', apellidos: 'García', email: 'ana.garcia@example.com', password: 'secret' },
  { nombre: 'Luis', apellidos: 'Martínez', email: 'luis.martinez@example.com', password: 'secret' },
  { nombre: 'María', apellidos: 'Rodríguez', email: 'maria.rodriguez@example.com', password: 'secret' },
  { nombre: 'Carlos', apellidos: 'Pérez', email: 'carlos.perez@example.com', password: 'secret' },
  { nombre: 'Test', apellidos: 'User', email: 'test.user@example.com', password: 'secret' }
];

async function ensureRoles(roles) {
  for (const r of roles) {
    const exists = await prisma.roles.findFirst({ where: { tipo: r.tipo } });
    if (!exists) {
      await prisma.roles.create({ data: r });
    }
  }
}

async function ensureDepartamentos(list) {
  for (const d of list) {
    const exists = await prisma.departamentos.findFirst({ where: { nombre: d.nombre } });
    if (!exists) await prisma.departamentos.create({ data: d });
  }
}

async function ensurePeriodos(list) {
  for (const p of list) {
    const exists = await prisma.periodos.findFirst({ where: { periodo: p.periodo } });
    if (!exists) await prisma.periodos.create({ data: p });
  }
}

async function ensureTipos(list) {
  for (const t of list) {
    const exists = await prisma.tipos_documentos.findFirst({ where: { tipo: t.tipo } });
    if (!exists) await prisma.tipos_documentos.create({ data: t });
  }
}

async function ensureCuadroClasificacion(list) {
  for (const c of list) {
    const exists = await prisma.cuadro_clasificacion.findFirst({ where: { codigo: c.codigo } });
    if (!exists) await prisma.cuadro_clasificacion.create({ data: c });
  }
}

async function ensureValoresDocumentales(list) {
  for (const v of list) {
    const exists = await prisma.valores_documentales.findFirst({ where: { clave: v.clave } });
    if (!exists) await prisma.valores_documentales.create({ data: v });
  }
}

async function ensurePlazosConservacion(list) {
  for (const p of list) {
    const exists = await prisma.plazos_conservacion.findFirst({ where: { clave: p.clave } });
    if (!exists) await prisma.plazos_conservacion.create({ data: p });
  }
}

async function ensureDestinosFinales(list) {
  for (const d of list) {
    const exists = await prisma.destinos_finales.findFirst({ where: { clave: d.clave } });
    if (!exists) await prisma.destinos_finales.create({ data: d });
  }
}

async function ensureSoportesDocumentales(list) {
  for (const s of list) {
    const exists = await prisma.soportes_documentales.findFirst({ where: { clave: s.clave } });
    if (!exists) await prisma.soportes_documentales.create({ data: s });
  }
}

async function createUsers(users) {
  const created = [];
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    const up = await prisma.usuarios.upsert({
      where: { email: u.email },
      update: { nombre: u.nombre, apellidos: u.apellidos, password: hashed, activo: 1 },
      create: { nombre: u.nombre, apellidos: u.apellidos, email: u.email, password: hashed, activo: 1 }
    });
    created.push(up);
  }
  return created;
}

async function assignRoles(userMap) {
  // userMap: [{ userEmail, roleTipo }]
  for (const u of userMap) {
    const user = await prisma.usuarios.findUnique({ where: { email: u.userEmail } });
    const role = await prisma.roles.findFirst({ where: { tipo: u.roleTipo } });
    if (user && role) {
      if (user.role_id !== role.id) {
        await prisma.usuarios.update({ where: { id: user.id }, data: { role_id: role.id } });
      }
    }
  }
}

async function createDocuments({ count = 20 } = {}) {
  const users = await prisma.usuarios.findMany({ select: { id: true, email: true } });
  const tipos = await prisma.tipos_documentos.findMany({ select: { id: true } });
  const departamentos = await prisma.departamentos.findMany({ select: { id: true } });
  const periodos = await prisma.periodos.findMany({ select: { id: true } });
  const cuadros = await prisma.cuadro_clasificacion.findMany({ select: { id: true, codigo: true, titulo: true } });
  const valores = await prisma.valores_documentales.findMany({ select: { id: true, clave: true, nombre: true } });
  const plazos = await prisma.plazos_conservacion.findMany({ select: { id: true, clave: true, descripcion: true } });
  const destinos = await prisma.destinos_finales.findMany({ select: { id: true, clave: true, nombre: true } });
  const soportes = await prisma.soportes_documentales.findMany({ select: { id: true, clave: true, nombre: true } });

  if (users.length === 0) throw new Error('No users for documents');
  if (tipos.length === 0) throw new Error('No tipos_documentos');

  const MIME_OPTIONS = [
    { mime: 'application/pdf', ext: '.pdf' },
    { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: '.docx' },
    { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: '.xlsx' }
  ];

  const sampleNames = [
    'Acta de reunión', 'Informe anual', 'Contrato de prestación', 'Informe financiero', 'Plan de trabajo', 'Minuta', 'Evaluación'
  ];

  for (let i = 0; i < count; i++) {
    const pickMime = MIME_OPTIONS[i % MIME_OPTIONS.length];
    const baseName = sampleNames[i % sampleNames.length];
    const filename = `${baseName.replace(/\s+/g, '_')}_${Date.now()}_${i}${pickMime.ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    // generar contenido simulado (no binario real para pdf/docx/xlsx, pero sirve como placeholder)
    const content = `${baseName} - documento generado por seed (${i})\nFecha: ${new Date().toISOString()}`;
    fs.writeFileSync(filepath, content);
    const stats = fs.statSync(filepath);

    const cuadro = cuadros.length ? cuadros[i % cuadros.length] : null;
    const valor = valores.length ? valores[i % valores.length] : null;
    const plazo = plazos.length ? plazos[i % plazos.length] : null;
    const destino = destinos.length ? destinos[i % destinos.length] : null;
    const soporte = soportes.length ? soportes[i % soportes.length] : null;

    const createData = {
      nombre: baseName,
      descripcion: `${baseName} generado por seed (#${i})`,
      mime: pickMime.mime,
      ruta: `uploads/${filename}`,
      file_key: filename,
      size: stats.size,
      checksum: null,
      tipos_documentos_id: tipos[i % tipos.length].id,
      usuarios_id: users[i % users.length].id,
      fecha_creacion: new Date(Date.now() - (i * 86400000)), // escalonar fechas
      fecha_subida: new Date(Date.now() - (i * 86400000)),
      departamentos_id: departamentos.length ? departamentos[i % departamentos.length].id : null,
      periodos_id: periodos.length ? periodos[i % periodos.length].id : null,
  // legacy strings (llenar desde los catálogos cuando exista)
  // nota: `valor_documental` y `soporte` en el schema son enums; no escribimos strings inválidos
  codigo_clasificacion: cuadro ? cuadro.codigo : null,
  valor_documental: null,
  plazo_conservacion: plazo ? plazo.descripcion : null,
  destino_final: destino ? destino.nombre : null,
  soporte: null,

      // referencias a catálogos (FK)
      codigo_clasificacion_id: cuadro ? cuadro.id : null,
      valor_documental_id: valor ? valor.id : null,
      plazo_conservacion_id: plazo ? plazo.id : null,
      destino_final_id: destino ? destino.id : null,
      soporte_id: soporte ? soporte.id : null,
      procedencia: 'seed',
      estado_vigencia: i % 5 === 0 ? 'VENCIDO' : 'VIGENTE'
    };

    await prisma.documentos.create({ data: createData });
  }
}

async function createFavoritos() {
  const users = await prisma.usuarios.findMany({ select: { id: true } });
  const docs = await prisma.documentos.findMany({ select: { id: true } });
  for (let i = 0; i < Math.min(docs.length, users.length); i++) {
    const usuario_id = users[i % users.length].id;
    const documento_id = docs[i % docs.length].id;
    const exists = await prisma.favoritos.findFirst({ where: { usuario_id, documento_id } });
    if (!exists) {
      await prisma.favoritos.create({ data: { usuario_id, documento_id } });
    }
  }
}

async function createBitacora() {
  const users = await prisma.usuarios.findMany({ select: { id: true } });
  const acciones = ['login', 'creacion', 'subida', 'actualizacion', 'eliminacion', 'descarga', 'revisión'];
  const ips = ['127.0.0.1', '192.168.1.10', '10.0.0.5'];

  // Crear múltiples entradas por usuario con distintas acciones
  for (const u of users) {
    const count = 3 + (u.id % 3);
    for (let i = 0; i < count; i++) {
      const accion = acciones[(u.id + i) % acciones.length];
      await prisma.bitacora.create({
        data: {
          usuario_id: u.id,
          rol: null,
          accion,
          ip: ips[(u.id + i) % ips.length],
          descripcion: `Seed: acción ${accion} para usuario ${u.id}`,
          fecha_inicio: new Date(Date.now() - ((i + u.id) * 3600000)),
          fecha_act: new Date(Date.now() - ((i + u.id) * 3600000))
        }
      });
    }
  }
}

async function main() {
  try {
    console.log('Iniciando seed unificado...');

    const roles = [
      { tipo: 'admin', descripcion: 'Administrador', activo: true, fecha_creacion: new Date() },
      { tipo: 'capturista', descripcion: 'Capturista', activo: true, fecha_creacion: new Date() },
      { tipo: 'revisor', descripcion: 'Revisor', activo: true, fecha_creacion: new Date() }
    ];

    const departamentos = [
      { nombre: 'Administración y Finanzas', descripcion: 'Jefatura Administración y Finanzas', activo: true },
      { nombre: 'Contraloría e Investigación', descripcion: 'Jefatura Contraloría e Investigación', activo: true },
      { nombre: 'Coordinación General', descripcion: 'Jefatura Coordinación General', activo: true },
      { nombre: 'Informática', descripcion: 'Jefatura Informática', activo: true },
      { nombre: 'Jurídico', descripcion: 'Jefatura Jurídico', activo: true },
      { nombre: 'Operaciones Portuarias', descripcion: 'Jefatura Operaciones Portuarias', activo: true },
      { nombre: 'Planeación', descripcion: 'Jefatura Planeación', activo: true },
      { nombre: 'Recursos Humanos', descripcion: 'Jefatura Recursos Humanos', activo: true }
    ];

    const periodos = [
      { periodo: '2023', fecha_inicio: new Date('2023-01-01'), fecha_final: new Date('2023-12-31'), activo: true },
      { periodo: '2024', fecha_inicio: new Date('2024-01-01'), fecha_final: new Date('2024-12-31'), activo: true }
    ];

    const tipos = [
      { tipo: 'Informe' },
      { tipo: 'Acta' },
      { tipo: 'Contrato' }
    ];

    const cuadroClasificacion = [
      { codigo: '001', titulo: 'Normatividad y Legislación' },
      { codigo: '002', titulo: 'Planeación y Programación' },
      { codigo: '003', titulo: 'Organización y Funcionamiento' },
      { codigo: '004', titulo: 'Recursos Humanos' },
      { codigo: '005', titulo: 'Recursos Financieros' },
      { codigo: '006', titulo: 'Recursos Materiales y Servicios' },
      { codigo: '007', titulo: 'Servicios Portuarios' },
      { codigo: '008', titulo: 'Operaciones Marítimas' },
      { codigo: '009', titulo: 'Seguridad Portuaria' },
      { codigo: '010', titulo: 'Medio Ambiente' },
      { codigo: '011', titulo: 'Tecnologías de la Información' },
      { codigo: '012', titulo: 'Comunicación Social' },
      { codigo: '013', titulo: 'Transparencia y Acceso a la Información' },
      { codigo: '014', titulo: 'Contraloría Interna' },
      { codigo: '015', titulo: 'Asuntos Jurídicos' }
    ];

    const valoresDocumentales = [
      { clave: 'administrativo', nombre: 'Administrativo' },
      { clave: 'legal', nombre: 'Legal' },
      { clave: 'fiscal', nombre: 'Fiscal' },
      { clave: 'historico', nombre: 'Histórico' },
      { clave: 'mixto', nombre: 'Mixto (Varios valores)' }
    ];

    const plazosConservacion = [
      { clave: '1', descripcion: '1 año' },
      { clave: '2', descripcion: '2 años' },
      { clave: '3', descripcion: '3 años' },
      { clave: '5', descripcion: '5 años' },
      { clave: '10', descripcion: '10 años' },
      { clave: '15', descripcion: '15 años' },
      { clave: '20', descripcion: '20 años' },
      { clave: '30', descripcion: '30 años' },
      { clave: 'permanente', descripcion: 'Conservación Permanente' }
    ];

    const destinosFinales = [
      { clave: 'conservacion_permanente', nombre: 'Conservación Permanente' },
      { clave: 'baja_documental', nombre: 'Baja Documental' },
      { clave: 'transferencia_historico', nombre: 'Transferencia a Archivo Histórico' }
    ];

    const soportesDocumentales = [
      { clave: 'original_fisico', nombre: 'Original Físico' },
      { clave: 'original_digital', nombre: 'Original Digital' },
      { clave: 'copia_fisica', nombre: 'Copia Física' },
      { clave: 'copia_digital', nombre: 'Copia Digital' },
      { clave: 'digitalizacion', nombre: 'Digitalización de Original Físico' }
    ];

    await ensureRoles(roles);
    await ensureDepartamentos(departamentos);
    // Obtener lista de departamentos ya creados para asignar a usuarios
    const allDepts = await prisma.departamentos.findMany({ select: { id: true, nombre: true } });
    await ensurePeriodos(periodos);
    await ensureTipos(tipos);

  // Crear catálogos documentales
  await ensureCuadroClasificacion(cuadroClasificacion);
  await ensureValoresDocumentales(valoresDocumentales);
  await ensurePlazosConservacion(plazosConservacion);
  await ensureDestinosFinales(destinosFinales);
  await ensureSoportesDocumentales(soportesDocumentales);

    // Priorizar usuarios desde seed_users (si existe)
  const users = Array.isArray(seedUsers) ? seedUsers : (seedUsers.users || []);
    if (!users || users.length === 0) {
      console.log('No se encontraron usuarios en seed_users, usando lista por defecto.');
    }

    const defaultUsers = users && users.length ? users : [
      { nombre: 'Jorge', apellidos: 'Garcia Vega', email: 'jorge.garcia@apibcs.com.mx', password: '123456' },
      { nombre: 'Ana', apellidos: 'García', email: 'ana.garcia@example.com', password: 'secret' },
      { nombre: 'Luis', apellidos: 'Martínez', email: 'luis.martinez@example.com', password: 'secret' }
    ];

    // Crear/actualizar usuarios y asignar departamentos_id
    for (let i = 0; i < defaultUsers.length; i++) {
      const u = defaultUsers[i];
      const hashed = await bcrypt.hash(u.password, 10);

      // Determinar departamento: si viene nombre en u.departamento, buscar; si no, usar round-robin
      let deptId = null;
      if (u.departamento) {
        const deptFound = await prisma.departamentos.findFirst({ where: { nombre: u.departamento } });
        if (deptFound) deptId = deptFound.id;
      }
      if (!deptId && allDepts.length > 0) {
        deptId = allDepts[i % allDepts.length].id;
      }

      const roleObj = u.role ? await prisma.roles.findFirst({ where: { tipo: u.role } }) : null;

      await prisma.usuarios.upsert({
        where: { email: u.email },
        update: {
          nombre: u.nombre,
          apellidos: u.apellidos,
          password: hashed,
          role_id: roleObj ? roleObj.id : null,
          departamentos_id: deptId,
          activo: 1
        },
        create: {
          nombre: u.nombre,
          apellidos: u.apellidos,
          email: u.email,
          password: hashed,
          role_id: roleObj ? roleObj.id : null,
          departamentos_id: deptId,
          activo: 1
        }
      });
      console.log('Seed usuario:', u.email, 'deptId:', deptId);
    }

    // asignar roles por defecto (mapear por email)
     const roleMap = [
       { userEmail: 'jorge.garcia@apibcs.com.mx', roleTipo: 'admin' },
       { userEmail: 'ana.garcia@example.com', roleTipo: 'capturista' },
       { userEmail: 'luis.martinez@example.com', roleTipo: 'revisor' }
     ];

     await assignRoles(roleMap);

    // Asignar roles por defecto a usuarios restantes: solo 'capturista' o 'revisor'
    const defaultRoleOptions = ['capturista', 'revisor'];
    const remainingUsers = await prisma.usuarios.findMany({ where: { role_id: null }, select: { id: true, email: true } });
    if (remainingUsers.length > 0) {
      console.log(`Asignando roles por defecto a ${remainingUsers.length} usuarios...`);
      for (let i = 0; i < remainingUsers.length; i++) {
        const u = remainingUsers[i];
        const tipo = defaultRoleOptions[i % defaultRoleOptions.length]; // alternar para reproducibilidad
        const role = await prisma.roles.findFirst({ where: { tipo } });
        if (role) {
          await prisma.usuarios.update({ where: { id: u.id }, data: { role_id: role.id } });
          console.log(` - ${u.email} => ${tipo}`);
        }
      }
    }

    await createDocuments({ count: 30 });
    await createFavoritos();
    await createBitacora();

    console.log('Seed unificado completado');
  } catch (e) {
    console.error('Error en seed unificado:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
