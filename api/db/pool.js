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

// Alora Mobile app database pool (attendance, leave, bugar, face, webauthn)
export const aloraMobilePool = mysql.createPool({
  host: process.env.DB_ALORA_MOBILE_HOST,
  port: parseInt(process.env.DB_ALORA_MOBILE_PORT),
  user: process.env.DB_ALORA_MOBILE_USER,
  password: process.env.DB_ALORA_MOBILE_PASS,
  database: process.env.DB_ALORA_MOBILE_NAME,
  timezone: '+07:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Alora Academy database pool (skill matrix, penugasan LO)
export const academyPool = mysql.createPool({
  host: process.env.DB_ALORA_ACADEMY_HOST,
  port: parseInt(process.env.DB_ALORA_ACADEMY_PORT),
  user: process.env.DB_ALORA_ACADEMY_USER,
  password: process.env.DB_ALORA_ACADEMY_PASS,
  database: process.env.DB_ALORA_ACADEMY_NAME,
  timezone: '+07:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// my_waschen database pool (mst_role, sumber cabang karyawan untuk LO)
export const myWaschenPool = mysql.createPool({
  host: process.env.DB_HOST_MY_WASCHEN,
  port: parseInt(process.env.DB_PORT_MY_WASCHEN),
  user: process.env.DB_USER_MY_WASCHEN,
  password: process.env.DB_PASS_MY_WASCHEN,
  database: process.env.DB_NAME_MY_WASCHEN,
  timezone: '+07:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
