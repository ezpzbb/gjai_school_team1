-- ============================================
-- 대시보드 테스트 데이터 삽입 스크립트
-- MySQL Workbench에서 실행용
-- ============================================

-- 1단계: CCTV ID 확인 및 설정
-- 아래 쿼리로 실제 CCTV ID를 확인한 후, @test_cctv_id 값을 변경하세요
-- SELECT cctv_id, location FROM cctv LIMIT 5;

-- 테스트할 CCTV ID 설정 (실제 CCTV ID로 변경 필요!)
SET @test_cctv_id = 149419;

-- 테스트할 시간대 설정 (같은 시간대에 여러 프레임 생성)
SET @test_hour = '2024-01-15 10:00:00';

-- ============================================
-- 2단계: Frame 데이터 삽입
-- ============================================

-- Frame 1 삽입
INSERT INTO frame (cctv_id, timestamp, image_path) 
VALUES (@test_cctv_id, @test_hour, '/test/frame1.jpg');
SET @frame_id_1 = LAST_INSERT_ID();

-- Frame 2 삽입 (같은 시간대, 5분 후)
INSERT INTO frame (cctv_id, timestamp, image_path) 
VALUES (@test_cctv_id, DATE_ADD(@test_hour, INTERVAL 5 MINUTE), '/test/frame2.jpg');
SET @frame_id_2 = LAST_INSERT_ID();

-- Frame 3 삽입 (같은 시간대, 10분 후)
INSERT INTO frame (cctv_id, timestamp, image_path) 
VALUES (@test_cctv_id, DATE_ADD(@test_hour, INTERVAL 10 MINUTE), '/test/frame3.jpg');
SET @frame_id_3 = LAST_INSERT_ID();

-- Frame 4 삽입 (같은 시간대, 15분 후)
INSERT INTO frame (cctv_id, timestamp, image_path) 
VALUES (@test_cctv_id, DATE_ADD(@test_hour, INTERVAL 15 MINUTE), '/test/frame4.jpg');
SET @frame_id_4 = LAST_INSERT_ID();

-- Frame 5 삽입 (같은 시간대, 20분 후)
INSERT INTO frame (cctv_id, timestamp, image_path) 
VALUES (@test_cctv_id, DATE_ADD(@test_hour, INTERVAL 20 MINUTE), '/test/frame5.jpg');
SET @frame_id_5 = LAST_INSERT_ID();

-- ============================================
-- 3단계: Congestion 데이터 삽입
-- ============================================

INSERT INTO congestion (frame_id, level, timestamp, calculated_at) VALUES
(@frame_id_1, 30, DATE_ADD(@test_hour, INTERVAL 2 SECOND), DATE_ADD(@test_hour, INTERVAL 2 SECOND)),
(@frame_id_2, 45, DATE_ADD(DATE_ADD(@test_hour, INTERVAL 5 MINUTE), INTERVAL 2 SECOND), DATE_ADD(DATE_ADD(@test_hour, INTERVAL 5 MINUTE), INTERVAL 2 SECOND)),
(@frame_id_3, 60, DATE_ADD(DATE_ADD(@test_hour, INTERVAL 10 MINUTE), INTERVAL 2 SECOND), DATE_ADD(DATE_ADD(@test_hour, INTERVAL 10 MINUTE), INTERVAL 2 SECOND)),
(@frame_id_4, 75, DATE_ADD(DATE_ADD(@test_hour, INTERVAL 15 MINUTE), INTERVAL 2 SECOND), DATE_ADD(DATE_ADD(@test_hour, INTERVAL 15 MINUTE), INTERVAL 2 SECOND)),
(@frame_id_5, 50, DATE_ADD(DATE_ADD(@test_hour, INTERVAL 20 MINUTE), INTERVAL 2 SECOND), DATE_ADD(DATE_ADD(@test_hour, INTERVAL 20 MINUTE), INTERVAL 2 SECOND));

-- ============================================
-- 4단계: Detection 데이터 삽입
-- ============================================

-- Frame 1의 Detection들
INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_1, 0.95, '100,100,200,200', DATE_ADD(@test_hour, INTERVAL 2 SECOND), 'car');
SET @detection_id_1_1 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_1, 0.88, '300,150,150,180', DATE_ADD(@test_hour, INTERVAL 2 SECOND), 'person');
SET @detection_id_1_2 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_1, 0.92, '500,200,180,200', DATE_ADD(@test_hour, INTERVAL 2 SECOND), 'car');
SET @detection_id_1_3 = LAST_INSERT_ID();

-- Frame 2의 Detection들
INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_2, 0.90, '120,110,190,190', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 5 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_2_1 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_2, 0.85, '320,160,140,170', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 5 MINUTE), INTERVAL 2 SECOND), 'person');
SET @detection_id_2_2 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_2, 0.93, '520,210,170,190', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 5 MINUTE), INTERVAL 2 SECOND), 'truck');
SET @detection_id_2_3 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_2, 0.87, '700,250,160,180', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 5 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_2_4 = LAST_INSERT_ID();

-- Frame 3의 Detection들
INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_3, 0.94, '110,105,195,195', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 10 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_3_1 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_3, 0.89, '310,155,145,175', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 10 MINUTE), INTERVAL 2 SECOND), 'person');
SET @detection_id_3_2 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_3, 0.91, '510,205,175,195', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 10 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_3_3 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_3, 0.86, '710,255,155,175', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 10 MINUTE), INTERVAL 2 SECOND), 'bus');
SET @detection_id_3_4 = LAST_INSERT_ID();

-- Frame 4의 Detection들
INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_4, 0.96, '105,100,200,200', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 15 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_4_1 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_4, 0.90, '305,150,150,180', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 15 MINUTE), INTERVAL 2 SECOND), 'person');
SET @detection_id_4_2 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_4, 0.92, '505,200,180,200', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 15 MINUTE), INTERVAL 2 SECOND), 'truck');
SET @detection_id_4_3 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_4, 0.88, '705,250,160,180', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 15 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_4_4 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_4, 0.85, '905,300,145,165', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 15 MINUTE), INTERVAL 2 SECOND), 'motorcycle');
SET @detection_id_4_5 = LAST_INSERT_ID();

-- Frame 5의 Detection들
INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_5, 0.93, '115,115,185,185', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 20 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_5_1 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_5, 0.88, '315,165,140,170', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 20 MINUTE), INTERVAL 2 SECOND), 'person');
SET @detection_id_5_2 = LAST_INSERT_ID();

INSERT INTO detection (frame_id, confidence, bounding_box, detected_at, object_text) VALUES
(@frame_id_5, 0.91, '515,215,170,190', DATE_ADD(DATE_ADD(@test_hour, INTERVAL 20 MINUTE), INTERVAL 2 SECOND), 'car');
SET @detection_id_5_3 = LAST_INSERT_ID();

-- ============================================
-- 5단계: Statistics 데이터 삽입
-- ============================================

-- Frame 1의 Statistics (3개 detection)
INSERT INTO statistics (detection_id, object_count, vehicle_total) VALUES
(@detection_id_1_1, 3, 2),      -- car, person, car -> 객체 3개, 차량 2개
(@detection_id_1_2, 3, 2),
(@detection_id_1_3, 3, 2);

-- Frame 2의 Statistics (4개 detection)
INSERT INTO statistics (detection_id, object_count, vehicle_total) VALUES
(@detection_id_2_1, 4, 3),      -- car, person, truck, car -> 객체 4개, 차량 3개
(@detection_id_2_2, 4, 3),
(@detection_id_2_3, 4, 3),
(@detection_id_2_4, 4, 3);

-- Frame 3의 Statistics (4개 detection)
INSERT INTO statistics (detection_id, object_count, vehicle_total) VALUES
(@detection_id_3_1, 4, 3),      -- car, person, car, bus -> 객체 4개, 차량 3개
(@detection_id_3_2, 4, 3),
(@detection_id_3_3, 4, 3),
(@detection_id_3_4, 4, 3);

-- Frame 4의 Statistics (5개 detection)
INSERT INTO statistics (detection_id, object_count, vehicle_total) VALUES
(@detection_id_4_1, 5, 4),      -- car, person, truck, car, motorcycle -> 객체 5개, 차량 4개
(@detection_id_4_2, 5, 4),
(@detection_id_4_3, 5, 4),
(@detection_id_4_4, 5, 4),
(@detection_id_4_5, 5, 4);

-- Frame 5의 Statistics (3개 detection)
INSERT INTO statistics (detection_id, object_count, vehicle_total) VALUES
(@detection_id_5_1, 3, 2),      -- car, person, car -> 객체 3개, 차량 2개
(@detection_id_5_2, 3, 2),
(@detection_id_5_3, 3, 2);

-- ============================================
-- 6단계: 데이터 확인 쿼리
-- ============================================

-- 분석 완료 시간대 조회 테스트
SELECT 
  DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00') as start_time,
  COUNT(DISTINCT f.frame_id) as frame_count,
  COUNT(DISTINCT c.congestion_id) as congestion_count,
  COUNT(DISTINCT d.detection_id) as detection_count,
  COUNT(DISTINCT s.statistics_id) as statistics_count
FROM frame f
INNER JOIN congestion c ON f.frame_id = c.frame_id
INNER JOIN detection d ON f.frame_id = d.frame_id
INNER JOIN statistics s ON d.detection_id = s.detection_id
WHERE f.cctv_id = @test_cctv_id
  AND DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00') = DATE_FORMAT(@test_hour, '%Y-%m-%d %H:00:00')
GROUP BY DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00');

-- 삽입된 데이터 상세 확인
SELECT 
  f.frame_id,
  f.timestamp,
  c.level as congestion_level,
  COUNT(DISTINCT d.detection_id) as detection_count,
  COUNT(DISTINCT s.statistics_id) as statistics_count
FROM frame f
LEFT JOIN congestion c ON f.frame_id = c.frame_id
LEFT JOIN detection d ON f.frame_id = d.frame_id
LEFT JOIN statistics s ON d.detection_id = s.detection_id
WHERE f.cctv_id = @test_cctv_id
  AND DATE_FORMAT(f.timestamp, '%Y-%m-%d %H:00:00') = DATE_FORMAT(@test_hour, '%Y-%m-%d %H:00:00')
GROUP BY f.frame_id, f.timestamp, c.level
ORDER BY f.timestamp;

-- ============================================
-- 테스트 데이터 삭제 (필요시 실행)
-- ============================================
-- 주의: 아래 쿼리는 테스트 데이터를 모두 삭제합니다!
-- DELETE FROM frame 
-- WHERE cctv_id = @test_cctv_id 
--   AND timestamp >= @test_hour 
--   AND timestamp < DATE_ADD(@test_hour, INTERVAL 1 HOUR);
-- (CASCADE로 인해 관련된 congestion, detection, statistics도 자동 삭제됨)

