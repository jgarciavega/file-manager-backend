// app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

console.log("🧪 JWT_SECRET:", process.env.JWT_SECRET);


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
const departamentosRoutes = require('./src/routes/departamentos');
const { loadUserRoles } = require('./src/middleware/roles');
const authRoutes = require('./src/routes/auth');
const { verifyToken } = require('./src/middleware/auth');
const tiposDocumentosRoutes = require("./src/routes/tiposDocumentos");
const favoritosRoutes = require("./src/routes/favoritos");

// Montar /api/auth primero (debe permanecer público para login/register)
app.use('/api/auth', authRoutes);

// Proteger por defecto todas las rutas bajo /api (excepto las montadas antes)
app.use('/api', verifyToken);
// Cargar roles en req.user para las rutas protegidas
app.use(loadUserRoles);

// Usar rutas (ya protegidas por el middleware global anterior)
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/documentos", documentosRoutes);
app.use("/api/tipos-documentos", tiposDocumentosRoutes);
// Usar bitacora router: si el módulo exporta { router } o bien exporta el router directamente
app.use("/api/bitacora", bitacoraRoutes.router || bitacoraRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/departamentos', departamentosRoutes);
app.use('/api/favoritos', favoritosRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
