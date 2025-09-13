// app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globales (deben ir antes de las rutas)
app.use(cors());
app.use(express.json());
// Aceptar bodies enviados como application/x-www-form-urlencoded (formularios)
app.use(express.urlencoded({ extended: true }));

// Servir archivos subidos públicamente
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Importar rutas principales
const usuariosRoutes = require("./src/routes/usuarios");
const documentosRoutes = require("./src/routes/documentos");
const bitacoraRoutes = require("./src/routes/bitacora");
const rolesRoutes = require("./src/routes/roles");
const { loadUserRoles } = require('./src/middleware/roles');

// Usar rutas
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/documentos", documentosRoutes);
// Usar bitacora router: si el módulo exporta { router } o bien exporta el router directamente
app.use("/api/bitacora", bitacoraRoutes.router || bitacoraRoutes);
// Cargar roles en req.user si existe (no interrumpe si no hay auth)
app.use(loadUserRoles);
app.use('/api/roles', rolesRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({
    message: 'Backend de documentos funcionando correctamente',
    endpoints: {
      usuarios: '/api/usuarios',
      documentos: '/api/documentos'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
  console.log(`📁 Documentos API: http://localhost:${PORT}/api/documentos`);
  console.log(`👥 Usuarios API: http://localhost:${PORT}/api/usuarios`);
});
