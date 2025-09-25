-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NULL,
    `apellidos` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `departamentos_id` INTEGER NULL,
    `role_id` INTEGER NULL,
    `activo` INTEGER NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `mime` VARCHAR(191) NULL,
    `ruta` VARCHAR(191) NULL,
    `file_key` VARCHAR(191) NULL,
    `size` INTEGER NULL,
    `checksum` VARCHAR(191) NULL,
    `tipos_documentos_id` INTEGER NULL,
    `usuarios_id` INTEGER NULL,
    `fecha_creacion` DATETIME(3) NULL,
    `fecha_subida` DATETIME(3) NULL,
    `departamentos_id` INTEGER NULL,
    `nivel_acceso` ENUM('PUBLIC', 'CONFIDENTIAL', 'RESTRICTED') NULL,
    `codigo_clasificacion` VARCHAR(191) NULL,
    `numero_expediente` VARCHAR(191) NULL,
    `serie` VARCHAR(191) NULL,
    `subserie` VARCHAR(191) NULL,
    `valor_documental` ENUM('TEMPORAL', 'PERMANENT') NULL,
    `plazo_conservacion` VARCHAR(191) NULL,
    `periodos_id` INTEGER NULL,
    `destino_final` VARCHAR(191) NULL,
    `soporte` ENUM('DIGITAL', 'FISICO', 'HIBRIDO') NULL,
    `procedencia` VARCHAR(191) NULL,
    `folio` VARCHAR(191) NULL,
    `tipo_documento_text` VARCHAR(191) NULL,
    `estado_vigencia` VARCHAR(191) NULL,

    INDEX `tipos_documentos_id`(`tipos_documentos_id`),
    INDEX `usuarios_id`(`usuarios_id`),
    INDEX `documentos_departamentos_id_idx`(`departamentos_id`),
    INDEX `documentos_periodos_id_idx`(`periodos_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favoritos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documento_id` INTEGER NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usuario_id` INTEGER NOT NULL,

    INDEX `favoritos_documento_id_fkey`(`documento_id`),
    UNIQUE INDEX `favoritos_usuario_id_documento_id_key`(`usuario_id`, `documento_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `activo` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `periodos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `periodo` VARCHAR(191) NULL,
    `fecha_inicio` DATETIME(3) NULL,
    `fecha_final` DATETIME(3) NULL,
    `activo` BOOLEAN NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `procesos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estatus` ENUM('en_proceso', 'terminado') NOT NULL,
    `resultado` ENUM('aprobado', 'rechazado', 'en_revision') NULL,
    `fecha_inicio` DATETIME(3) NULL,
    `fecha_fin` DATETIME(3) NULL,
    `departamentos_id` INTEGER NULL,
    `periodos_id` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('admin', 'capturista', 'revisor') NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `activo` BOOLEAN NULL,
    `fecha_creacion` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipos_documentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bitacora` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NULL,
    `rol` VARCHAR(191) NULL,
    `accion` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `descripcion` VARCHAR(191) NULL,
    `fecha_inicio` DATETIME(3) NULL,
    `fecha_act` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_departamentos_id_fkey` FOREIGN KEY (`departamentos_id`) REFERENCES `departamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_tipos_documentos_id_fkey` FOREIGN KEY (`tipos_documentos_id`) REFERENCES `tipos_documentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_usuarios_id_fkey` FOREIGN KEY (`usuarios_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_departamentos_id_fkey` FOREIGN KEY (`departamentos_id`) REFERENCES `departamentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_periodos_id_fkey` FOREIGN KEY (`periodos_id`) REFERENCES `periodos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favoritos` ADD CONSTRAINT `favoritos_documento_id_fkey` FOREIGN KEY (`documento_id`) REFERENCES `documentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favoritos` ADD CONSTRAINT `favoritos_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `procesos` ADD CONSTRAINT `procesos_departamentos_id_fkey` FOREIGN KEY (`departamentos_id`) REFERENCES `departamentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `procesos` ADD CONSTRAINT `procesos_periodos_id_fkey` FOREIGN KEY (`periodos_id`) REFERENCES `periodos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacora` ADD CONSTRAINT `bitacora_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
