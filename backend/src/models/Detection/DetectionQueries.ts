`
  CREATE TABLE detection (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  frame_id INT NOT NULL,
  class_name VARCHAR(64) NOT NULL,
  confidence FLOAT NOT NULL,
  de DATETIME NOT NULL,
  INDEX idx_frame_id (idx_frame_id, ts)
);
`;
