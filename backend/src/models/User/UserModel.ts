import { Pool, RowDataPacket } from 'mysql2/promise';
import db from '../../config/db';
import { UserQueries } from './UserQueries';
import { UserTransaction } from './UserTransactions';

export interface User {
  user_id: number;
  username: string;
  password: string; // 해시된 비밀번호
  email: string;
}

export interface UserRegisterInput {
  username: string;
  password: string;
  email: string;
}

export interface UserLoginInput {
  identifier: string; // username 또는 email
  password: string;
}

export interface UserAuthResponse {
  token: string;
  user: Omit<User, 'password'>;
}

const pool: Pool = db;
const userTransaction = new UserTransaction(pool);

export class UserModel {
  static async findUserByIdentifier(identifier: string): Promise<RowDataPacket | null> {
    if (!identifier || identifier === undefined) {
      throw new Error('identifier는 필수입니다.');
    }
    const [rows] = await pool.execute<RowDataPacket[]>(UserQueries.FIND_BY_IDENTIFIER, [identifier, identifier]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async findUserByUsername(username: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(UserQueries.FIND_BY_USERNAME, [username]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async findUserByEmail(email: string): Promise<RowDataPacket | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(UserQueries.FIND_BY_EMAIL, [email]);
    return rows.length > 0 ? rows[0] : null;
  }

  static async createUser(username: string, hashedPassword: string, email: string): Promise<number> {
    return await userTransaction.createUser(username, hashedPassword, email);
  }
}