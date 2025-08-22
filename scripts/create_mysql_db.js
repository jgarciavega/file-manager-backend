require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL no encontrada en .env');

    const url = new URL(dbUrl);
    const user = url.username;
    const password = url.password;
    const host = url.hostname;
    const port = url.port || 3306;
    const dbName = url.pathname.replace('/', '') || 'file_manager_dev';

    console.log(`Conectando a MySQL en ${host}:${port} como ${user}, creando BD ${dbName} si no existe...`);

    const conn = await mysql.createConnection({ host, port, user, password });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
    console.log('Base de datos creada o ya existente.');
    await conn.end();
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exitCode = 2;
  }
})();
