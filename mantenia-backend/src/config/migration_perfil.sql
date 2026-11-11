-- Ejecuta esto UNA VEZ en mantenia_db (pestaña SQL de phpMyAdmin) ANTES de reiniciar el backend.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE NULL;
