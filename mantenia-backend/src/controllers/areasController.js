const db = require('../config/db');

// GET /api/areas — pública, se necesita para mostrar el selector en el registro
exports.listar = async (req, res) => {
    try {
        const [areas] = await db.query('SELECT id, nombre FROM areas ORDER BY nombre');
        return res.status(200).json(areas);
    } catch (error) {
        console.error('Error en listar areas:', error);
        return res.status(500).json({ mensaje: 'Error al obtener las áreas' });
    }
};

// POST /api/areas — solo administradores
exports.crear = async (req, res) => {
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
        return res.status(400).json({ mensaje: 'El nombre del área es obligatorio' });
    }

    try {
        const [existente] = await db.query('SELECT id FROM areas WHERE nombre = ?', [nombre.trim()]);
        if (existente.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe un área con ese nombre' });
        }

        const [resultado] = await db.query('INSERT INTO areas (nombre) VALUES (?)', [nombre.trim()]);
        return res.status(201).json({ id: resultado.insertId, nombre: nombre.trim() });
    } catch (error) {
        console.error('Error en crear area:', error);
        return res.status(500).json({ mensaje: 'Error al crear el área' });
    }
};

// DELETE /api/areas/:id — solo administradores
exports.eliminar = async (req, res) => {
    const { id } = req.params;

    try {
        const [r] = await db.query('DELETE FROM areas WHERE id = ?', [id]);
        if (r.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'El área no existe' });
        }
        // Los usuarios que tenían esta área quedan con area_id = NULL automáticamente
        // (por el ON DELETE SET NULL de la migración).
        return res.status(200).json({ mensaje: 'Área eliminada' });
    } catch (error) {
        console.error('Error en eliminar area:', error);
        return res.status(500).json({ mensaje: 'Error al eliminar el área' });
    }
};
