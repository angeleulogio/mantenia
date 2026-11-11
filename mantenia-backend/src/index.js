require('dotenv').config();
const express = require('express');
const cors = require('cors');

const equipmentRoutes = require('./routes/equipmentRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const authRoutes = require('./routes/authRoutes');
const areasRoutes = require('./routes/areasRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/equipos', equipmentRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Ruta no encontrada
app.use((req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' }));

// JSON mal formado u otros errores no controlados
app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ mensaje: status === 400 ? 'JSON inválido' : 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor de Mantenia corriendo en http://localhost:${PORT}`);
});
