require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mantenia_db',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    // Bases en la nube (TiDB, Aiven, etc.) exigen conexión cifrada: DB_SSL=true
    ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined
});

module.exports = pool.promise();
