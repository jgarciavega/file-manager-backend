-- CreateTable
CREATE TABLE "usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT,
    "apellidos" TEXT,
    "email" TEXT,
    "password" TEXT,
    "activo" INTEGER DEFAULT 1
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT,
    "descripcion" TEXT,
    "mime" TEXT,
    "ruta" TEXT,
    "usuarios_id" INTEGER,
    "fecha_subida" DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentos_usuarios_id_fkey" FOREIGN KEY ("usuarios_id") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tipos_documentos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
