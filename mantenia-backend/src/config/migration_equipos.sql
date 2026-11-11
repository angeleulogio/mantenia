-- Ejecuta esto UNA VEZ en tu base mantenia_db existente para crear la tabla de equipos.
CREATE TABLE IF NOT EXISTS equipos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    estado ENUM('Sano','Alerta','Mantenimiento') NOT NULL DEFAULT 'Sano',
    numero_serie VARCHAR(100) NULL,
    area_id INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4;
