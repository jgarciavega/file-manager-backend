-- CreateTable bitacora
CREATE TABLE "bitacora" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "usuario_id" INTEGER,
  "accion" TEXT NOT NULL,
  "detalles" TEXT,
  "fecha_inicio" DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bitacora_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
