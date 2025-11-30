const { getConnection } = require('./db/dbConfig');
require('dotenv').config();

async function createTestUser() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        // 사용자 생성
        const sql = `
            MERGE INTO users u
            USING (SELECT 'student1' as id FROM dual) d
            ON (u.id = d.id)
            WHEN MATCHED THEN
                UPDATE SET password = '1234', role = 'student', email = 'student1@wordtest.com', username = '학생1'
            WHEN NOT MATCHED THEN
                INSERT (id, username, password, role, email)
                VALUES ('student1', '학생1', '1234', 'student', 'student1@wordtest.com')
        `;

        await connection.execute(sql, [], { autoCommit: true });
        console.log('✅ 테스트 계정 생성 완료: student1 / 1234');

    } catch (err) {
        console.error('❌ 계정 생성 실패:', err);
    } finally {
        if (connection) await connection.close();
    }
}

createTestUser();
