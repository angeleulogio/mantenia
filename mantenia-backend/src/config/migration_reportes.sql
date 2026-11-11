-- Ejecuta esto UNA VEZ en tu base mantenia_db (pestaña SQL de phpMyAdmin).
-- 1) Agrega el estado "Revision" a los equipos
ALTER TABLE equipos
    MODIFY estado ENUM('Sano','Alerta','Mantenimiento','Revision') NOT NULL DEFAULT 'Sano';

-- 2) Tabla de reportes (historial de cada equipo)
CREATE TABLE IF NOT EXISTS reportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    usuario_id INT NULL,
    tipo ENUM('Mantenimiento','Alerta','Revision','Otro') NOT NULL,
    estado_anterior ENUM('Sano','Alerta','Mantenimiento','Revision') NOT NULL,
    estado_resultante ENUM('Sano','Alerta','Mantenimiento','Revision') NOT NULL,
    descripcion TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reportes_equipo (equipo_id, creado_en),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4;
