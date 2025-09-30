-- Migration: add CHECK constraint to periodos to ensure fecha_inicio <= fecha_final
ALTER TABLE `periodos`
  ADD CONSTRAINT `periodos_fecha_check` CHECK (`fecha_inicio` IS NULL OR `fecha_final` IS NULL OR `fecha_inicio` <= `fecha_final`);