const { getConnection } = require('./db/dbConfig');
require('dotenv').config();

async function fixDb() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        // 컬럼 추가 (에러 나면 무시 - 이미 있을 수 있음)
        const alters = [
            `ALTER TABLE users ADD (password VARCHAR2(255))`,
            `ALTER TABLE users ADD (role VARCHAR2(20) DEFAULT 'student')`,
            `ALTER TABLE users ADD (email VARCHAR2(255))`
        ];

        for (const sql of alters) {
            try {
                await connection.execute(sql);
                console.log('✅ 컬럼 추가 성공:', sql);
            } catch (e) {
                console.log('⚠️ 컬럼 추가 건너뜀 (이미 존재?):', e.message);
            }
        }

        // 사용자 생성 재시도
        const userSql = `
            MERGE INTO users u
            USING (SELECT 'student1' as id FROM dual) d
            ON (u.id = d.id)
            WHEN MATCHED THEN
                UPDATE SET password = '1234', role = 'student', email = 'student1@wordtest.com', username = '학생1'
            WHEN NOT MATCHED THEN
                INSERT (id, username, password, role, email)
                VALUES ('student1', '학생1', '1234', 'student', 'student1@wordtest.com')
        `;
        await connection.execute(userSql, [], { autoCommit: true });
        console.log('✅ 테스트 계정 생성 완료: student1 / 1234');

    } catch (err) {
        console.error('❌ DB 수정 실패:', err);
    } finally {
        if (connection) await connection.close();
    }
}

fixDb();
