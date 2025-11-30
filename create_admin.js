const { getConnection } = require('./db/dbConfig');
require('dotenv').config();

async function createAdminUser() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        const sql = `
            MERGE INTO users u
            USING (SELECT 'admin' as id FROM dual) d
            ON (u.id = d.id)
            WHEN MATCHED THEN
                UPDATE SET password = '1234', role = 'admin', email = 'admin@wordtest.com', username = '관리자'
            WHEN NOT MATCHED THEN
                INSERT (id, username, password, role, email)
                VALUES ('admin', '관리자', '1234', 'admin', 'admin@wordtest.com')
        `;

        await connection.execute(sql, [], { autoCommit: true });
        console.log('✅ 관리자 계정 생성 완료: admin / 1234');

    } catch (err) {
        console.error('❌ 계정 생성 실패:', err);
    } finally {
        if (connection) await connection.close();
    }
}

createAdminUser();
