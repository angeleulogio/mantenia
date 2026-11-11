-- Ejecuta esto UNA VEZ en mantenia_db (pestaña SQL de phpMyAdmin) ANTES de reiniciar el backend.
ALTER TABLE reportes
    MODIFY tipo ENUM('Mantenimiento','Alerta','Revision','Otro','Alta','CambioArea') NOT NULL;

INSERT INTO reportes (equipo_id, usuario_id, tipo, estado_anterior, estado_resultante, descripcion, creado_en)
SELECT e.id, NULL, 'Alta', e.estado, e.estado, 'Equipo registrado', e.creado_en
FROM equipos e
WHERE NOT EXISTS (SELECT 1 FROM reportes r WHERE r.equipo_id = e.id AND r.tipo = 'Alta');
