import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'new_schema',
  charset: 'utf8mb4',
  connectionLimit: 10,
});

export async function initializeDatabase(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ 데이터베이스 연결 성공: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    connection.release();
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('✅ 데이터베이스 연결 종료');
  } catch (error) {
    console.error('❌ 데이터베이스 연결 종료 실패:', error);
    throw error;
  }
}

export default pool;