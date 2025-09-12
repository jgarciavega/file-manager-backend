# File Manager Backend

Backend API para un sistema de gestión documental empresarial construido con Node.js, Express y Prisma ORM.

## 🚀 Características

- **Gestión de Usuarios** - CRUD completo con sistema de roles
- **Gestión de Documentos** - Subida, categorización y metadata
- **Sistema de Favoritos** - Documentos favoritos por usuario
- **Organización por Departamentos** - Estructura empresarial
- **Control de Roles** - Admin, Capturista, Revisor
- **Gestión de Procesos** - Flujos de trabajo con estados
- **Períodos de Tiempo** - Gestión temporal de procesos
- **Bitácora de Auditoría** - Registro completo de actividades

## 🛠️ Tecnologías

- **Node.js** - Runtime de JavaScript
- **Express.js** - Framework web
- **Prisma ORM** - Object-Relational Mapping
- **MySQL** - Base de datos
- **CORS** - Cross-Origin Resource Sharing

## 📋 Prerrequisitos

- Node.js >= 16.x
- MySQL >= 8.0
- npm o yarn

## ⚙️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd file-manager-backend
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   Edita el archivo `.env` con tu configuración de base de datos.

4. **Configurar la base de datos**
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```

5. **Iniciar el servidor**
   ```bash
   npm run dev
   ```

## 📚 API Endpoints

### Usuarios
- `GET /api/usuarios` - Obtener todos los usuarios
- `GET /api/usuarios/:id` - Obtener usuario por ID
- `POST /api/usuarios` - Crear nuevo usuario
- `PUT /api/usuarios/:id` - Actualizar usuario
- `DELETE /api/usuarios/:id` - Eliminar usuario

### Documentos
- `GET /api/documentos` - Obtener todos los documentos
- `GET /api/documentos/:id` - Obtener documento por ID
- `POST /api/documentos` - Crear nuevo documento
- `PUT /api/documentos/:id` - Actualizar documento
- `DELETE /api/documentos/:id` - Eliminar documento

### Favoritos
- `GET /api/favoritos` - Obtener favoritos
- `GET /api/favoritos/usuario/:usuario_id` - Favoritos de un usuario
- `POST /api/favoritos` - Agregar a favoritos
- `DELETE /api/favoritos/:id` - Eliminar favorito
- `GET /api/favoritos/check/:documento_id/:usuario_id` - Verificar favorito

### Departamentos
- `GET /api/departamentos` - Obtener departamentos
- `GET /api/departamentos/:id` - Obtener departamento por ID
- `POST /api/departamentos` - Crear departamento
- `PUT /api/departamentos/:id` - Actualizar departamento
- `DELETE /api/departamentos/:id` - Eliminar departamento
- `GET /api/departamentos/:id/usuarios` - Usuarios del departamento

### Roles
- `GET /api/roles` - Obtener roles
- `GET /api/roles/:id` - Obtener rol por ID
- `POST /api/roles` - Crear rol
- `PUT /api/roles/:id` - Actualizar rol
- `DELETE /api/roles/:id` - Eliminar rol
- `GET /api/roles/:id/usuarios` - Usuarios con un rol
- `GET /api/roles/meta/tipos` - Tipos de roles disponibles

### Tipos de Documentos
- `GET /api/tipos-documentos` - Obtener tipos
- `GET /api/tipos-documentos/:id` - Obtener tipo por ID
- `POST /api/tipos-documentos` - Crear tipo
- `PUT /api/tipos-documentos/:id` - Actualizar tipo
- `DELETE /api/tipos-documentos/:id` - Eliminar tipo
- `GET /api/tipos-documentos/meta/estadisticas` - Estadísticas

### Procesos
- `GET /api/procesos` - Obtener procesos
- `GET /api/procesos/:id` - Obtener proceso por ID
- `POST /api/procesos` - Crear proceso
- `PUT /api/procesos/:id` - Actualizar proceso
- `DELETE /api/procesos/:id` - Eliminar proceso
- `PATCH /api/procesos/:id/finalizar` - Finalizar proceso
- `GET /api/procesos/meta/estadisticas` - Estadísticas
- `GET /api/procesos/meta/enums` - Valores enum

### Períodos
- `GET /api/periodos` - Obtener períodos
- `GET /api/periodos/:id` - Obtener período por ID
- `POST /api/periodos` - Crear período
- `PUT /api/periodos/:id` - Actualizar período
- `DELETE /api/periodos/:id` - Eliminar período
- `GET /api/periodos/meta/activo` - Período activo actual
- `PATCH /api/periodos/:id/activar` - Activar período
- `PATCH /api/periodos/:id/desactivar` - Desactivar período

### Bitácora
- `GET /api/bitacora` - Obtener registros
- `GET /api/bitacora/:id` - Obtener registro por ID
- `POST /api/bitacora` - Crear registro
- `PUT /api/bitacora/:id` - Actualizar registro
- `DELETE /api/bitacora/:id` - Eliminar registro
- `GET /api/bitacora/usuario/:usuario_id` - Bitácora de usuario
- `GET /api/bitacora/meta/estadisticas` - Estadísticas
- `POST /api/bitacora/limpiar` - Limpiar registros antiguos

## 📊 Base de Datos

### Modelos Principales

#### Usuarios
- Información personal y credenciales
- Asociación con departamentos
- Sistema de roles múltiples

#### Documentos
- Metadatos completos (nombre, descripción, MIME, ruta)
- Categorización por tipos
- Relación con usuarios (propietario)

#### Sistema de Favoritos
- Relación many-to-many usuario-documento
- Timestamp de creación

#### Roles y Permisos
- Tres tipos: admin, capturista, revisor
- Asignación múltiple por usuario

#### Procesos de Negocio
- Estados: en_proceso, terminado
- Resultados: aprobado, rechazado, en_revision

## 🔒 Seguridad

- Validación de entrada en todos los endpoints
- Manejo centralizado de errores
- Respuestas consistentes
- Logging de auditoría en bitácora

## 📝 Scripts Disponibles

```bash
npm start          # Iniciar servidor en producción
npm run dev        # Iniciar servidor en desarrollo
npm run prisma:generate   # Generar cliente Prisma
npm run prisma:migrate    # Ejecutar migraciones
npm run prisma:deploy     # Deploy migraciones (producción)
npm run prisma:studio     # Abrir Prisma Studio
npm run prisma:reset      # Reset completo de DB
```

## 🚀 Deployement

1. Configurar variables de entorno de producción
2. Ejecutar migraciones: `npm run prisma:deploy`
3. Generar cliente: `npm run prisma:generate`
4. Iniciar servidor: `npm start`
