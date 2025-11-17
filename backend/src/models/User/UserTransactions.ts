import { Pool, PoolConnection } from 'mysql2/promise';
import { UserQueries } from './UserQueries';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

export class UserTransaction {
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    /**
     * User 테이블 초기화 및 관리자 계정 생성
     * @param connection 데이터베이스 연결
     */
    async initializeUserTable(connection: PoolConnection): Promise<void> {
        try {
            // User 테이블 존재 여부 확인
            const [tables] = await connection.execute<any[]>(
                UserQueries.CHECK_TABLE_EXISTS,
                [process.env.DB_NAME || 'new_schema']
            );
            
            // User 테이블이 없으면 생성
            if (tables.length === 0) {
                console.log('📋 User 테이블이 없습니다. 생성 중...');
                await connection.execute(UserQueries.CREATE_TABLE);
                console.log('✅ User 테이블 생성 완료');
            }
            
            // User 테이블이 비어있는지 확인
            const [users] = await connection.execute<any[]>(
                UserQueries.COUNT_USERS
            );
            
            // 사용자가 없으면 관리자 계정 생성
            if (users[0].count === 0) {
                console.log('👤 관리자 계정이 없습니다. 생성 중...');
                
                const adminUsername = process.env.ADMIN_USERNAME || 'admin';
                const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
                const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
                
                // 비밀번호 해싱
                const hashedPassword = await bcrypt.hash(adminPassword, 10);
                
                // 관리자 계정 생성
                await connection.execute(
                    UserQueries.CREATE_USER,
                    [adminUsername, hashedPassword, adminEmail]
                );
                
                console.log(`✅ 관리자 계정 생성 완료`);
                console.log(`   Username: ${adminUsername}`);
                console.log(`   Email: ${adminEmail}`);
                console.log(`   Password: ${adminPassword} (환경 변수로 변경 가능)`);
            }
        } catch (error) {
            console.error('❌ User 테이블 초기화 실패:', error);
            throw error;
        }
    }

    /**
     * 사용자 생성 (트랜잭션 처리)
     * @param username 사용자명
     * @param hashedPassword 해시된 비밀번호
     * @param email 이메일
     * @returns 생성된 사용자 ID
     */
    async createUser(username: string, hashedPassword: string, email: string): Promise<number> {
        const connection: PoolConnection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                UserQueries.CREATE_USER,
                [username, hashedPassword, email]
            );

            await connection.commit();
            return (result as any).insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

