-- Esquema COMPLETO para una base de datos nueva. Ejecútalo en `mantenia_db`.
-- (Si ya tienes una base creada, usa migration_equipos.sql, migration_reportes.sql y migration_historial.sql)

CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL, -- aquí se guarda el HASH, nunca la contraseña en texto plano
    es_admin TINYINT(1) NOT NULL DEFAULT 0,
    area_id INT NULL,
    fecha_nacimiento DATE NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS equipos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    estado ENUM('Sano','Alerta','Mantenimiento','Revision') NOT NULL DEFAULT 'Sano',
    numero_serie VARCHAR(100) NULL,
    area_id INT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    usuario_id INT NULL,
    tipo ENUM('Mantenimiento','Alerta','Revision','Otro','Alta','CambioArea') NOT NULL,
    estado_anterior ENUM('Sano','Alerta','Mantenimiento','Revision') NOT NULL,
    estado_resultante ENUM('Sano','Alerta','Mantenimiento','Revision') NOT NULL,
    descripcion TEXT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reportes_equipo (equipo_id, creado_en),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO areas (nombre) VALUES
    ('Producción'), ('Mantenimiento'), ('Calidad'), ('Administración');
