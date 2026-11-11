// Archivo conservado solo por compatibilidad: toda la lógica vive en ./auth.js
const { verificarToken, verificarAdmin } = require('./auth');
module.exports = { verificarToken, soloAdmin: verificarAdmin };
