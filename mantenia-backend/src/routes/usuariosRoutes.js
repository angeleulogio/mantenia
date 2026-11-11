const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

router.get('/', verificarToken, verificarAdmin, usuariosController.listar);
router.patch('/:id', verificarToken, verificarAdmin, usuariosController.actualizar);
router.delete('/:id', verificarToken, verificarAdmin, usuariosController.eliminar);

module.exports = router;
