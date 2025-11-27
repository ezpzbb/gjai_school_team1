import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { UserTransaction } from "../models/User/UserTransactions";
import { FavoriteTransaction } from "../models/Favorites/FavoriteTransactions";
import { CCTVTransaction } from "../models/Camera/CameraTransactions";
import { FrameTransaction } from "../models/Frame/FrameTransactions";
import { CongestionTransaction } from "../models/Congestion/CongestionTransactions";
import { DetectionTransaction } from "../models/Detection/DetectionTransactions";
import { StatisticsTransaction } from "../models/Statistics/StatisticsTransactions";
import { NotificationTransaction } from "../models/Notification/NotificationTransactions";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "new_schema",
  charset: "utf8mb4",
  connectionLimit: 10,
});

export async function initializeDatabase(): Promise<void> {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ 데이터베이스 연결 성공: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

    // 테이블 초기화 순서: User -> CCTV -> Frame -> Congestion -> Detection -> Statistics -> Notification -> Favorite
    // (외래키 의존성 순서대로 생성)

    // 1. User 테이블 초기화 및 관리자 계정 생성
    const userTransaction = new UserTransaction(pool);
    await userTransaction.initializeUserTable(connection);

    // 2. CCTV 테이블 초기화
    const cctvTransaction = new CCTVTransaction(pool);
    await cctvTransaction.initializeCCTVTable(connection);

    // 3. Frame 테이블 초기화 (CCTV에 의존)
    const frameTransaction = new FrameTransaction(pool);
    await frameTransaction.initializeFrameTable(connection);

    // 4. Congestion 테이블 초기화 (Frame에 의존)
    const congestionTransaction = new CongestionTransaction(pool);
    await congestionTransaction.initializeCongestionTable(connection);

    // 5. Detection 테이블 초기화 (Frame에 의존)
    const detectionTransaction = new DetectionTransaction(pool);
    await detectionTransaction.initializeDetectionTable(connection);

    // 6. Statistics 테이블 초기화 (Detection에 의존)
    const statisticsTransaction = new StatisticsTransaction(pool);
    await statisticsTransaction.initializeStatisticsTable(connection);

    // 7. Notification 테이블 초기화 (User, CCTV, Congestion에 의존)
    const notificationTransaction = new NotificationTransaction(pool);
    await notificationTransaction.initializeNotificationTable(connection);

    // 8. Favorite 테이블 초기화 (User, CCTV에 의존)
    const favoriteTransaction = new FavoriteTransaction(pool);
    await favoriteTransaction.initializeFavoriteTable(connection);

    connection.release();
  } catch (error) {
    console.error("❌ 데이터베이스 연결 실패:", error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log("✅ 데이터베이스 연결 종료");
  } catch (error) {
    console.error("❌ 데이터베이스 연결 종료 실패:", error);
    throw error;
  }
}

export default pool;
