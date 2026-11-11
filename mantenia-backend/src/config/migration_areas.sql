-- Ejecuta esto UNA VEZ en phpMyAdmin, con la base mantenia_db seleccionada.
-- Agrega el sistema de áreas y el rol de administrador.

CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO areas (nombre) VALUES
    ('Producción'),
    ('Mantenimiento'),
    ('Calidad'),
    ('Administración');

ALTER TABLE usuarios ADD COLUMN area_id INT NULL;
ALTER TABLE usuarios ADD COLUMN es_admin TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_area
    FOREIGN KEY (area_id) REFERENCES areas(id)
    ON DELETE SET NULL;

-- Después de correr esto y de registrar tu primer usuario desde la app,
-- vuelve a phpMyAdmin y corre esta línea (cambia el correo) para hacerlo
-- administrador manualmente. Ya con un admin, los demás se asignan desde la app.
-- UPDATE usuarios SET es_admin = 1 WHERE email = 'tu-correo@ejemplo.com';
