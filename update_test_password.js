const { getConnection } = require('./db/dbConfig');
const bcrypt = require('bcrypt');

async function updateTestUserPassword() {
    let connection;
    try {
        connection = await getConnection();

        // 비밀번호 해시 생성
        const hashedPassword = await bcrypt.hash('1234', 10);
        console.log('생성된 해시:', hashedPassword);

        // 두 테스트 사용자 모두 업데이트
        await connection.execute(
            `UPDATE users SET password = :password WHERE username = :username`,
            { password: hashedPassword, username: '테스트' },
            { autoCommit: true }
        );

        console.log('테스트 사용자의 비밀번호가 업데이트되었습니다.');
        console.log('이제 ID: "테스트", 비밀번호: "1234"로 로그인할 수 있습니다.');

    } catch (err) {
        console.error('오류:', err);
    } finally {
        if (connection) await connection.close();
    }
}

updateTestUserPassword();
