const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.warn('[AVISO] JWT_SECRET no está definido en .env. Se usa una clave de desarrollo INSEGURA.');
}
const AREA_MANTENIMIENTO = 'mantenimiento';
const SECRET = JWT_SECRET || 'clave-de-desarrollo-no-usar-en-produccion';

// Revisa el header "Authorization: Bearer <token>" y carga el usuario ACTUAL desde la BD,
// así un cambio de rol/área hecho por un admin se aplica de inmediato (no a los 7 días).
exports.verificarToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ mensaje: 'No autorizado: falta el token', exito: false });
    }

    let payload;
    try {
        payload = jwt.verify(authHeader.split(' ')[1], SECRET);
    } catch (error) {
        return res.status(401).json({ mensaje: 'Token inválido o expirado, inicia sesión de nuevo', exito: false });
    }

    try {
        const [filas] = await db.query(
            `SELECT u.id, u.email, u.es_admin, u.area_id, a.nombre AS area_nombre
             FROM usuarios u LEFT JOIN areas a ON a.id = u.area_id
             WHERE u.id = ?`,
            [payload.id]
        );
        if (filas.length === 0) {
            return res.status(401).json({ mensaje: 'El usuario ya no existe', exito: false });
        }
        const u = filas[0];
        req.usuario = {
            id: u.id,
            email: u.email,
            esAdmin: !!u.es_admin,
            areaId: u.area_id,
            areaNombre: u.area_nombre,
            // El personal del área "Mantenimiento" puede gestionar equipos de todas las áreas
            esMantenimiento: String(u.area_nombre || '').trim().toLowerCase() === AREA_MANTENIMIENTO
        };
        next();
    } catch (error) {
        console.error('Error en verificarToken:', error);
        return res.status(500).json({ mensaje: 'Error al validar la sesión', exito: false });
    }
};

// Debe usarse DESPUÉS de verificarToken
exports.verificarAdmin = (req, res, next) => {
    if (!req.usuario || !req.usuario.esAdmin) {
        return res.status(403).json({ mensaje: 'Solo un administrador puede hacer esto', exito: false });
    }
    next();
};

// Admin o personal de Mantenimiento
exports.verificarAdminOMantenimiento = (req, res, next) => {
    if (!req.usuario || !(req.usuario.esAdmin || req.usuario.esMantenimiento)) {
        return res.status(403).json({ mensaje: 'Solo administradores o el área de Mantenimiento pueden hacer esto', exito: false });
    }
    next();
};

exports.JWT_SECRET = SECRET;
