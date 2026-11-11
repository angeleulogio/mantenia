const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const { verificarToken, verificarAdmin, verificarAdminOMantenimiento } = require('../middleware/auth');

router.get('/', verificarToken, equipmentController.listar);
router.post('/', verificarToken, verificarAdminOMantenimiento, equipmentController.crear);

router.get('/:id', verificarToken, equipmentController.obtener);
router.put('/:id', verificarToken, equipmentController.editar);
router.delete('/:id', verificarToken, verificarAdmin, equipmentController.eliminar);

// Reportes de un equipo (cualquier usuario con acceso a ese equipo)
router.get('/:id/reportes', verificarToken, equipmentController.listarReportes);
router.post('/:id/reportes', verificarToken, equipmentController.crearReporte);

module.exports = router;
