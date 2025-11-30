const { getConnection } = require('./db/dbConfig');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createAdminUser() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        // Hash the password
        const hashedPassword = await bcrypt.hash('rudwls83', 10);

        const sql = `
            MERGE INTO users u
            USING (SELECT '김태훈' as id FROM dual) d
            ON (u.id = d.id)
            WHEN MATCHED THEN
                UPDATE SET password = :password, role = 'admin', email = 'admin@wordtest.com', username = '김태훈'
            WHEN NOT MATCHED THEN
                INSERT (id, username, password, role, email)
                VALUES ('김태훈', '김태훈', :password, 'admin', 'admin@wordtest.com')
        `;

        await connection.execute(sql, [hashedPassword, hashedPassword], { autoCommit: true });
        console.log('✅ 관리자 계정 생성 완료');
        console.log('   아이디: 김태훈');
        console.log('   비밀번호: rudwls83');
        console.log('   역할: admin');

    } catch (err) {
        console.error('❌ 계정 생성 실패:', err);
    } finally {
        if (connection) await connection.close();
    }
}

createAdminUser();
