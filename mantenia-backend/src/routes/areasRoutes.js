const express = require('express');
const router = express.Router();
const areasController = require('../controllers/areasController');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

router.get('/', areasController.listar); // pública: se usa en el selector de registro
router.post('/', verificarToken, verificarAdmin, areasController.crear);
router.delete('/:id', verificarToken, verificarAdmin, areasController.eliminar);

module.exports = router;
