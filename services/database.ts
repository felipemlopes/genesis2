import mysql from 'mysql2/promise';

// DEV - CONFIGURAR: Preencher as variáveis no .env com os dados do banco MySQL da Hostinger.
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
    connectionLimit: 10,
});

export const getConnection = async () => {
    return await pool.getConnection();
};

export default pool;
