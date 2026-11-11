const db = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/usuarios — solo administradores: lista todos los usuarios con su área y rol
exports.listar = async (req, res) => {
    try {
        const [usuarios] = await db.query(
            `SELECT u.id, u.nombre, u.email, u.es_admin AS esAdmin, u.area_id AS areaId, a.nombre AS areaNombre
             FROM usuarios u
             LEFT JOIN areas a ON a.id = u.area_id
             ORDER BY u.nombre`
        );
        const formateados = usuarios.map((u) => ({ ...u, esAdmin: !!u.esAdmin }));
        return res.status(200).json(formateados);
    } catch (error) {
        console.error('Error en listar usuarios:', error);
        return res.status(500).json({ mensaje: 'Error al obtener usuarios' });
    }
};

// PATCH /api/usuarios/:id — solo administradores: cambia área y/o si es admin
exports.actualizar = async (req, res) => {
    const { id } = req.params;
    // La app (Gson) no envía campos null, así que usa areaId = 0 para significar "Sin asignar".
    const esAdmin = req.body.esAdmin;
    const areaId = req.body.areaId === 0 ? null : req.body.areaId;

    // Evita que un admin se quite el rol a sí mismo por accidente y se quede
    // sin forma de administrar el sistema.
    if (esAdmin === false && req.usuario.id === parseInt(id, 10)) {
        return res.status(400).json({ mensaje: 'No puedes quitarte el rol de administrador a ti mismo' });
    }

    const campos = [];
    const valores = [];

    // Solo un administrador puede cambiar el correo de una cuenta
    if (req.body.nombre !== undefined) {
        const nombre = String(req.body.nombre).trim();
        if (!nombre || nombre.length > 150) {
            return res.status(400).json({ mensaje: 'El nombre no es válido' });
        }
        campos.push('nombre = ?');
        valores.push(nombre);
    }
    if (req.body.email !== undefined) {
        const email = String(req.body.email).trim().toLowerCase();
        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ mensaje: 'El correo no tiene un formato válido' });
        }
        const [otro] = await db.query('SELECT id FROM usuarios WHERE email = ? AND id <> ?', [email, id]);
        if (otro.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo' });
        }
        campos.push('email = ?');
        valores.push(email);
    }

    if (areaId !== undefined) {
        if (areaId !== null) {
            const [area] = await db.query('SELECT id FROM areas WHERE id = ?', [areaId]);
            if (area.length === 0) {
                return res.status(400).json({ mensaje: 'El área seleccionada no existe' });
            }
        }
        campos.push('area_id = ?');
        valores.push(areaId);
    }
    if (esAdmin !== undefined) {
        campos.push('es_admin = ?');
        valores.push(esAdmin ? 1 : 0);
    }

    if (campos.length === 0) {
        return res.status(400).json({ mensaje: 'No hay nada que actualizar' });
    }

    valores.push(id);

    try {
        const [r] = await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);
        if (r.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'El usuario no existe' });
        }
        return res.status(200).json({ mensaje: 'Usuario actualizado correctamente' });
    } catch (error) {
        console.error('Error en actualizar usuario:', error);
        return res.status(500).json({ mensaje: 'Error al actualizar usuario' });
    }
};

// DELETE /api/usuarios/:id — solo administradores: borra una cuenta.
// Sus reportes se conservan (quedan como "usuario eliminado").
exports.eliminar = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ mensaje: 'Id de usuario inválido' });
    }
    if (id === req.usuario.id) {
        return res.status(400).json({ mensaje: 'No puedes borrar tu propia cuenta' });
    }
    try {
        const [r] = await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
        if (r.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'El usuario no existe' });
        }
        return res.status(200).json({ mensaje: 'Usuario eliminado' });
    } catch (error) {
        console.error('Error en eliminar usuario:', error);
        return res.status(500).json({ mensaje: 'Error al eliminar el usuario' });
    }
};
