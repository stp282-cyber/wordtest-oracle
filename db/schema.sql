-- Users Table (Enhanced)
-- 기존 테이블이 있다면: ALTER TABLE users ADD (password VARCHAR2(255), role VARCHAR2(20) DEFAULT 'student', email VARCHAR2(255));
-- 여기서는 새로 만드는 것을 가정하거나, init_db.js가 에러를 무시하므로 CREATE 문을 유지하되 필요한 컬럼을 포함합니다.
-- 실제 운영 중이라면 ALTER 문을 써야 하지만, 지금은 초기 단계이므로 DROP 후 다시 만드는 게 깔끔할 수 있습니다.
-- 하지만 데이터 보존을 위해 IF NOT EXISTS 로직이 없으므로, 수동으로 관리해야 합니다.
-- 일단 필요한 테이블들을 정의합니다.

-- Test Results Table
CREATE TABLE test_results (
    id VARCHAR2(50) PRIMARY KEY,
    user_id VARCHAR2(50) NOT NULL,
    date_taken TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score NUMBER,
    total_questions NUMBER,
    correct_answers NUMBER,
    wrong_answers NUMBER,
    details CLOB, -- JSON 데이터 저장
    CONSTRAINT fk_test_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Dollar History Table
CREATE TABLE dollar_history (
    id VARCHAR2(50) PRIMARY KEY,
    user_id VARCHAR2(50) NOT NULL,
    amount NUMBER,
    reason VARCHAR2(255),
    type VARCHAR2(50), -- 'earned', 'spent', 'adjusted'
    date_earned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dollar_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Students Table (Optional, can be merged with users but sometimes separate profile is good)
-- For now, we stick to 'users' table with 'role' column.
