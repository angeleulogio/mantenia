const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const { verificarToken } = require('../middleware/auth');

router.get('/recientes', verificarToken, equipmentController.reportesRecientes);

module.exports = router;
