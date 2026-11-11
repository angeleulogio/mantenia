const db = require('../config/db');

const ESTADOS = ['Sano', 'Alerta', 'Mantenimiento', 'Revision'];
const TIPOS_REPORTE = ['Mantenimiento', 'Alerta', 'Revision', 'Otro'];
const MAX_DESCRIPCION = 2000;

const SELECT_EQUIPO = `
    SELECT e.id, e.codigo, e.nombre, e.estado, e.numero_serie AS numeroSerie,
           e.area_id AS areaId, a.nombre AS areaNombre
    FROM equipos e
    LEFT JOIN areas a ON a.id = e.area_id`;

// Admin y Mantenimiento gestionan equipos de TODAS las áreas; el resto solo los de su área.
const veTodo = (u) => u.esAdmin || u.esMantenimiento;
const puedeAcceder = (u, areaIdEquipo) =>
    veTodo(u) || (u.areaId != null && u.areaId === areaIdEquipo);

const parseId = (valor) => {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const existeArea = async (areaId) => {
    const [r] = await db.query('SELECT id FROM areas WHERE id = ?', [areaId]);
    return r.length > 0;
};

const buscarArea = async (areaId) => {
    if (areaId === null || areaId === undefined) return null;
    const [r] = await db.query('SELECT id, nombre FROM areas WHERE id = ?', [areaId]);
    return r[0] || null;
};

// Anota un evento automático (alta, cambio de área) en el historial del equipo.
const registrarEvento = (conn, equipoId, usuarioId, tipo, estado, descripcion) =>
    conn.query(
        `INSERT INTO reportes (equipo_id, usuario_id, tipo, estado_anterior, estado_resultante, descripcion)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [equipoId, usuarioId, tipo, estado, estado, descripcion]
    );

// Carga un equipo y verifica que el usuario pueda acceder; si no, responde el error y devuelve null.
const cargarEquipoConAcceso = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
        res.status(400).json({ mensaje: 'Id de equipo inválido' });
        return null;
    }
    const [filas] = await db.query(`${SELECT_EQUIPO} WHERE e.id = ?`, [id]);
    if (filas.length === 0) {
        res.status(404).json({ mensaje: 'El equipo no existe' });
        return null;
    }
    if (!puedeAcceder(req.usuario, filas[0].areaId)) {
        res.status(403).json({ mensaje: 'No tienes permiso sobre equipos de otra área' });
        return null;
    }
    return filas[0];
};

// GET /api/equipos
exports.listar = async (req, res) => {
    try {
        let sql = SELECT_EQUIPO;
        const params = [];
        if (!veTodo(req.usuario)) {
            sql += ' WHERE e.area_id = ?';
            params.push(req.usuario.areaId ?? -1); // sin área => lista vacía
        }
        sql += ' ORDER BY e.codigo';
        const [equipos] = await db.query(sql, params);
        return res.status(200).json(equipos);
    } catch (error) {
        console.error('Error en listar equipos:', error);
        return res.status(500).json({ mensaje: 'Error al obtener los equipos' });
    }
};

// GET /api/equipos/:id
exports.obtener = async (req, res) => {
    try {
        const equipo = await cargarEquipoConAcceso(req, res);
        if (!equipo) return;
        return res.status(200).json(equipo);
    } catch (error) {
        console.error('Error en obtener equipo:', error);
        return res.status(500).json({ mensaje: 'Error al obtener el equipo' });
    }
};

// POST /api/equipos — solo admin o Mantenimiento (ver routes)
exports.crear = async (req, res) => {
    const codigo = String(req.body.codigo || '').trim();
    const nombre = String(req.body.nombre || '').trim();
    const estado = req.body.estado || 'Sano';
    const numeroSerie = req.body.numeroSerie ? String(req.body.numeroSerie).trim() : null;
    // Gson no envía null; 0 también significa "sin área"
    const areaId = req.body.areaId ? req.body.areaId : null;

    if (!codigo || !nombre) {
        return res.status(400).json({ mensaje: 'El código y el nombre son obligatorios' });
    }
    if (!ESTADOS.includes(estado)) {
        return res.status(400).json({ mensaje: `El estado debe ser uno de: ${ESTADOS.join(', ')}` });
    }

    let conexion;
    try {
        const area = await buscarArea(areaId);
        if (areaId !== null && !area) {
            return res.status(400).json({ mensaje: 'El área seleccionada no existe' });
        }
        conexion = await db.getConnection();
        await conexion.beginTransaction();
        const [r] = await conexion.query(
            'INSERT INTO equipos (codigo, nombre, estado, numero_serie, area_id) VALUES (?, ?, ?, ?, ?)',
            [codigo, nombre, estado, numeroSerie, areaId]
        );
        await registrarEvento(conexion, r.insertId, req.usuario.id, 'Alta', estado,
            `Equipo registrado en ${area ? area.nombre : 'sin área asignada'}`);
        await conexion.commit();
        const [filas] = await db.query(`${SELECT_EQUIPO} WHERE e.id = ?`, [r.insertId]);
        return res.status(201).json(filas[0]);
    } catch (error) {
        if (conexion) await conexion.rollback().catch(() => {});
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ mensaje: 'Ya existe un equipo con ese código' });
        }
        console.error('Error en crear equipo:', error);
        return res.status(500).json({ mensaje: 'Error al crear el equipo' });
    } finally {
        if (conexion) conexion.release();
    }
};

// PUT /api/equipos/:id — nombre, número de serie y área.
// El ESTADO no se cambia aquí: se cambia subiendo un reporte (queda historial).
// El área solo la pueden cambiar admin y Mantenimiento. areaId = 0 => sin área.
exports.editar = async (req, res) => {
    let conexion;
    try {
        const equipo = await cargarEquipoConAcceso(req, res);
        if (!equipo) return;

        const campos = [];
        const valores = [];
        const { nombre, numeroSerie } = req.body;
        let cambioArea = null; // { anterior, nueva } si el área realmente cambia

        if (nombre !== undefined) {
            if (!String(nombre).trim()) return res.status(400).json({ mensaje: 'El nombre no puede estar vacío' });
            campos.push('nombre = ?'); valores.push(String(nombre).trim());
        }
        if (numeroSerie !== undefined) {
            campos.push('numero_serie = ?'); valores.push(numeroSerie ? String(numeroSerie).trim() : null);
        }
        if (req.body.areaId !== undefined) {
            if (!veTodo(req.usuario)) {
                return res.status(403).json({ mensaje: 'Solo administradores o Mantenimiento pueden cambiar el área de un equipo' });
            }
            const areaId = req.body.areaId === 0 ? null : req.body.areaId;
            if (areaId !== null && !(await existeArea(areaId))) {
                return res.status(400).json({ mensaje: 'El área seleccionada no existe' });
            }
            campos.push('area_id = ?'); valores.push(areaId);
            if (areaId !== equipo.areaId) {
                cambioArea = { anterior: equipo.areaNombre, nueva: (await buscarArea(areaId))?.nombre };
            }
        }
        if (campos.length === 0) {
            return res.status(400).json({ mensaje: 'No hay nada que actualizar' });
        }

        valores.push(equipo.id);
        conexion = await db.getConnection();
        await conexion.beginTransaction();
        await conexion.query(`UPDATE equipos SET ${campos.join(', ')} WHERE id = ?`, valores);
        if (cambioArea) {
            await registrarEvento(conexion, equipo.id, req.usuario.id, 'CambioArea', equipo.estado,
                `Área: ${cambioArea.anterior || 'Sin asignar'} → ${cambioArea.nueva || 'Sin asignar'}`);
        }
        await conexion.commit();
        const [filas] = await db.query(`${SELECT_EQUIPO} WHERE e.id = ?`, [equipo.id]);
        return res.status(200).json(filas[0]);
    } catch (error) {
        if (conexion) await conexion.rollback().catch(() => {});
        console.error('Error en editar equipo:', error);
        return res.status(500).json({ mensaje: 'Error al editar el equipo' });
    } finally {
        if (conexion) conexion.release();
    }
};

// DELETE /api/equipos/:id — solo admin (ver routes). Borra también sus reportes.
exports.eliminar = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ mensaje: 'Id de equipo inválido' });
        const [r] = await db.query('DELETE FROM equipos WHERE id = ?', [id]);
        if (r.affectedRows === 0) {
            return res.status(404).json({ mensaje: 'El equipo no existe' });
        }
        return res.status(200).json({ mensaje: 'Equipo eliminado' });
    } catch (error) {
        console.error('Error en eliminar equipo:', error);
        return res.status(500).json({ mensaje: 'Error al eliminar el equipo' });
    }
};

// ===================== REPORTES =====================
const SELECT_REPORTE = `
    SELECT r.id, r.equipo_id AS equipoId, r.tipo,
           r.estado_anterior AS estadoAnterior, r.estado_resultante AS estadoResultante,
           r.descripcion, u.nombre AS usuarioNombre,
           DATE_FORMAT(r.creado_en, '%Y-%m-%d %H:%i') AS creadoEn
    FROM reportes r
    LEFT JOIN usuarios u ON u.id = r.usuario_id`;

// GET /api/equipos/:id/reportes — historial, el más reciente primero
exports.listarReportes = async (req, res) => {
    try {
        const equipo = await cargarEquipoConAcceso(req, res);
        if (!equipo) return;
        const [reportes] = await db.query(
            `${SELECT_REPORTE} WHERE r.equipo_id = ? ORDER BY r.creado_en DESC, r.id DESC`,
            [equipo.id]
        );
        return res.status(200).json(reportes);
    } catch (error) {
        console.error('Error en listar reportes:', error);
        return res.status(500).json({ mensaje: 'Error al obtener los reportes' });
    }
};

// POST /api/equipos/:id/reportes
// Body: { tipo, descripcion, estado? }. Si viene "estado", el equipo pasa a ese estado
// (todo en una transacción: o se guardan reporte y estado, o ninguno).
exports.crearReporte = async (req, res) => {
    const tipo = req.body.tipo;
    const descripcion = String(req.body.descripcion || '').trim();
    const estadoNuevo = req.body.estado;

    if (!TIPOS_REPORTE.includes(tipo)) {
        return res.status(400).json({ mensaje: `El tipo debe ser uno de: ${TIPOS_REPORTE.join(', ')}` });
    }
    if (!descripcion) {
        return res.status(400).json({ mensaje: 'Describe qué se hizo o qué se encontró' });
    }
    if (descripcion.length > MAX_DESCRIPCION) {
        return res.status(400).json({ mensaje: `La descripción no puede pasar de ${MAX_DESCRIPCION} caracteres` });
    }
    if (estadoNuevo !== undefined && estadoNuevo !== null && !ESTADOS.includes(estadoNuevo)) {
        return res.status(400).json({ mensaje: `El estado debe ser uno de: ${ESTADOS.join(', ')}` });
    }

    let conexion;
    try {
        const equipo = await cargarEquipoConAcceso(req, res);
        if (!equipo) return;

        conexion = await db.getConnection();
        await conexion.beginTransaction();

        // Bloquea la fila para que dos reportes simultáneos no se pisen el estado
        const [[actual]] = await conexion.query('SELECT estado FROM equipos WHERE id = ? FOR UPDATE', [equipo.id]);
        const estadoAnterior = actual.estado;
        const estadoResultante = estadoNuevo || estadoAnterior;

        const [r] = await conexion.query(
            `INSERT INTO reportes (equipo_id, usuario_id, tipo, estado_anterior, estado_resultante, descripcion)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [equipo.id, req.usuario.id, tipo, estadoAnterior, estadoResultante, descripcion]
        );
        if (estadoResultante !== estadoAnterior) {
            await conexion.query('UPDATE equipos SET estado = ? WHERE id = ?', [estadoResultante, equipo.id]);
        }
        await conexion.commit();

        const [filas] = await db.query(`${SELECT_REPORTE} WHERE r.id = ?`, [r.insertId]);
        return res.status(201).json(filas[0]);
    } catch (error) {
        if (conexion) await conexion.rollback().catch(() => {});
        console.error('Error en crear reporte:', error);
        return res.status(500).json({ mensaje: 'Error al guardar el reporte' });
    } finally {
        if (conexion) conexion.release();
    }
};

// GET /api/reportes/recientes?limit=10 — últimos reportes (solo los subidos por usuarios,
// no los eventos automáticos). Admin/Mantenimiento ven todos; el resto, los de su área.
exports.reportesRecientes = async (req, res) => {
    try {
        let limite = parseInt(req.query.limit, 10);
        if (!Number.isInteger(limite) || limite < 1) limite = 10;
        limite = Math.min(limite, 50);

        const params = [...TIPOS_REPORTE];
        let sql = `
            SELECT r.id, r.equipo_id AS equipoId, e.codigo AS equipoCodigo, e.nombre AS equipoNombre,
                   r.tipo, r.estado_anterior AS estadoAnterior, r.estado_resultante AS estadoResultante,
                   r.descripcion, u.nombre AS usuarioNombre,
                   DATE_FORMAT(r.creado_en, '%Y-%m-%d %H:%i') AS creadoEn
            FROM reportes r
            JOIN equipos e ON e.id = r.equipo_id
            LEFT JOIN usuarios u ON u.id = r.usuario_id
            WHERE r.tipo IN (${TIPOS_REPORTE.map(() => '?').join(', ')})`;
        if (!veTodo(req.usuario)) {
            sql += ' AND e.area_id = ?';
            params.push(req.usuario.areaId ?? -1);
        }
        sql += ' ORDER BY r.creado_en DESC, r.id DESC LIMIT ?';
        params.push(limite);

        const [filas] = await db.query(sql, params);
        return res.status(200).json(filas);
    } catch (error) {
        console.error('Error en reportes recientes:', error);
        return res.status(500).json({ mensaje: 'Error al obtener los reportes recientes' });
    }
};
