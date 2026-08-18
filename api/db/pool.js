import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Main Waschen database pool (contains users, mst_employee, mst_position, mst_department, mst_outlet)
export const mainPool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});