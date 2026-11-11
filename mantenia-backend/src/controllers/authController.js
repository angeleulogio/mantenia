const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const MIN_PASSWORD = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const limpiarEmail = (email) => String(email || '').trim().toLowerCase();

// POST /api/auth/register
exports.registrarUsuario = async (req, res) => {
    const nombre = String(req.body.nombre || '').trim();
    const email = limpiarEmail(req.body.email);
    const { contrasena, areaId } = req.body;

    if (!nombre || !email || !contrasena) {
        return res.status(400).json({ mensaje: 'Faltan campos obligatorios (nombre, email, contrasena)', exito: false });
    }
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ mensaje: 'El correo no tiene un formato válido', exito: false });
    }
    if (String(contrasena).length < MIN_PASSWORD) {
        return res.status(400).json({ mensaje: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`, exito: false });
    }

    try {
        const [existentes] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (existentes.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe una cuenta con ese correo', exito: false });
        }

        // Sin área => NULL ("Sin asignar", un admin la asigna después). Si viene, debe existir.
        let idAreaFinal = null;
        if (areaId !== undefined && areaId !== null) {
            const [area] = await db.query('SELECT id FROM areas WHERE id = ?', [areaId]);
            if (area.length === 0) {
                return res.status(400).json({ mensaje: 'El área seleccionada no existe', exito: false });
            }
            idAreaFinal = area[0].id;
        }

        const hash = await bcrypt.hash(contrasena, 10);
        await db.query(
            'INSERT INTO usuarios (nombre, email, contrasena, area_id) VALUES (?, ?, ?, ?)',
            [nombre, email, hash, idAreaFinal]
        );

        return res.status(201).json({ mensaje: 'Usuario registrado exitosamente', exito: true });
    } catch (error) {
        console.error('Error en registrarUsuario:', error);
        return res.status(500).json({ mensaje: 'Error al registrar usuario', exito: false });
    }
};

// POST /api/auth/reset-password
// Por defecto SOLO un administrador autenticado puede usarla (ver authRoutes.js).
exports.restablecerContrasena = async (req, res) => {
    const email = limpiarEmail(req.body.email);
    const { nuevaContrasena } = req.body;

    if (!email || !nuevaContrasena) {
        return res.status(400).json({ mensaje: 'Correo y nueva contraseña son obligatorios', exito: false });
    }
    if (String(nuevaContrasena).length < MIN_PASSWORD) {
        return res.status(400).json({ mensaje: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`, exito: false });
    }

    try {
        const [filas] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
        if (filas.length === 0) {
            return res.status(404).json({ mensaje: 'No existe una cuenta con ese correo', exito: false });
        }

        const hash = await bcrypt.hash(nuevaContrasena, 10);
        await db.query('UPDATE usuarios SET contrasena = ? WHERE email = ?', [hash, email]);

        return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente', exito: true });
    } catch (error) {
        console.error('Error en restablecerContrasena:', error);
        return res.status(500).json({ mensaje: 'Error al restablecer la contraseña', exito: false });
    }
};

// POST /api/auth/login
exports.login = async (req, res) => {
    const email = limpiarEmail(req.body.email);
    const { contrasena } = req.body;

    if (!email || !contrasena) {
        return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios', exito: false });
    }

    try {
        const [filas] = await db.query(
            `SELECT u.*, a.nombre AS area_nombre
             FROM usuarios u
             LEFT JOIN areas a ON a.id = u.area_id
             WHERE u.email = ?`,
            [email]
        );
        const usuario = filas[0];

        // Mismo mensaje si el correo no existe o la contraseña falla (no revela qué correos existen)
        const coincide = usuario ? await bcrypt.compare(contrasena, usuario.contrasena) : false;
        if (!usuario || !coincide) {
            return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos', exito: false });
        }

        const esAdmin = !!usuario.es_admin;
        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, esAdmin, areaId: usuario.area_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            token,
            mensaje: 'Inicio de sesión exitoso',
            exito: true,
            esAdmin,
            areaId: usuario.area_id,
            areaNombre: usuario.area_nombre
        });
    } catch (error) {
        console.error('Error en login:', error);
        return res.status(500).json({ mensaje: 'Error al iniciar sesión', exito: false });
    }
};

const SELECT_PERFIL = `
    SELECT u.id, u.nombre, u.email, u.es_admin, u.area_id, a.nombre AS area_nombre,
           DATE_FORMAT(u.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento
    FROM usuarios u LEFT JOIN areas a ON a.id = u.area_id WHERE u.id = ?`;

const formatearPerfil = (u) => ({
    id: u.id, nombre: u.nombre, email: u.email,
    esAdmin: !!u.es_admin, areaId: u.area_id, areaNombre: u.area_nombre,
    fechaNacimiento: u.fecha_nacimiento
});

// GET /api/auth/me  (requiere token) — datos, rol y área ACTUALES del usuario
exports.perfil = async (req, res) => {
    try {
        const [filas] = await db.query(SELECT_PERFIL, [req.usuario.id]);
        return res.status(200).json(formatearPerfil(filas[0]));
    } catch (error) {
        console.error('Error en perfil:', error);
        return res.status(500).json({ mensaje: 'Error al obtener el perfil' });
    }
};

// Valida "YYYY-MM-DD": fecha real, no futura y no anterior a 1900
const fechaValida = (texto) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
    const [y, m, d] = texto.split('-').map(Number);
    const f = new Date(Date.UTC(y, m - 1, d));
    if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return false;
    return y >= 1900 && f.getTime() <= Date.now();
};

// PUT /api/auth/perfil — cada usuario edita SU nombre y fecha de nacimiento.
// El correo, el área y el rol NO se pueden cambiar aquí (los gestiona un administrador).
exports.actualizarPerfil = async (req, res) => {
    const campos = [];
    const valores = [];

    if (req.body.nombre !== undefined) {
        const nombre = String(req.body.nombre).trim();
        if (!nombre) return res.status(400).json({ mensaje: 'El nombre no puede estar vacío' });
        if (nombre.length > 150) return res.status(400).json({ mensaje: 'El nombre es demasiado largo (máximo 150 caracteres)' });
        campos.push('nombre = ?'); valores.push(nombre);
    }
    if (req.body.fechaNacimiento !== undefined) {
        const fecha = String(req.body.fechaNacimiento).trim();
        // Gson no envía null: una cadena vacía significa "quitar la fecha"
        if (fecha === '') {
            campos.push('fecha_nacimiento = NULL');
        } else if (!fechaValida(fecha)) {
            return res.status(400).json({ mensaje: 'La fecha de nacimiento no es válida' });
        } else {
            campos.push('fecha_nacimiento = ?'); valores.push(fecha);
        }
    }
    if (campos.length === 0) {
        return res.status(400).json({ mensaje: 'No hay nada que actualizar' });
    }

    try {
        valores.push(req.usuario.id);
        await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);
        const [filas] = await db.query(SELECT_PERFIL, [req.usuario.id]);
        return res.status(200).json(formatearPerfil(filas[0]));
    } catch (error) {
        console.error('Error en actualizarPerfil:', error);
        return res.status(500).json({ mensaje: 'Error al actualizar el perfil' });
    }
};

// PUT /api/auth/password — cualquier usuario cambia SU contraseña confirmando la actual
exports.cambiarContrasena = async (req, res) => {
    const { contrasenaActual, nuevaContrasena } = req.body;

    if (!contrasenaActual || !nuevaContrasena) {
        return res.status(400).json({ mensaje: 'Escribe tu contraseña actual y la nueva' });
    }
    if (String(nuevaContrasena).length < MIN_PASSWORD) {
        return res.status(400).json({ mensaje: `La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres` });
    }
    if (nuevaContrasena === contrasenaActual) {
        return res.status(400).json({ mensaje: 'La nueva contraseña debe ser distinta de la actual' });
    }

    try {
        const [filas] = await db.query('SELECT contrasena FROM usuarios WHERE id = ?', [req.usuario.id]);
        const coincide = filas[0] ? await bcrypt.compare(contrasenaActual, filas[0].contrasena) : false;
        if (!coincide) {
            // 400 (no 401) para que la app no lo confunda con una sesión vencida
            return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta' });
        }
        const hash = await bcrypt.hash(nuevaContrasena, 10);
        await db.query('UPDATE usuarios SET contrasena = ? WHERE id = ?', [hash, req.usuario.id]);
        return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (error) {
        console.error('Error en cambiarContrasena:', error);
        return res.status(500).json({ mensaje: 'Error al cambiar la contraseña' });
    }
};
