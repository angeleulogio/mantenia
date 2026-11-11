const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken, verificarAdmin } = require('../middleware/auth');

// Restablecer contraseña: sin envío de correo no hay forma segura de verificar quién pide el
// cambio, así que por defecto solo un ADMIN autenticado puede hacerlo.
// Solo para desarrollo local puedes poner ALLOW_INSECURE_PASSWORD_RESET=true en el .env.
const resetGuard = process.env.ALLOW_INSECURE_PASSWORD_RESET === 'true'
    ? []
    : [verificarToken, verificarAdmin];

router.post('/register', authController.registrarUsuario);
router.post('/login', authController.login);
router.get('/me', verificarToken, authController.perfil);
router.put('/perfil', verificarToken, authController.actualizarPerfil);
router.put('/password', verificarToken, authController.cambiarContrasena);
router.post('/reset-password', ...resetGuard, authController.restablecerContrasena);

module.exports = router;
