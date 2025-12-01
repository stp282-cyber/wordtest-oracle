const { getConnection } = require('./db/dbConfig');

async function checkUser() {
    let connection;
    try {
        connection = await getConnection();

        // 테스트 사용자 확인
        const result = await connection.execute(
            `SELECT * FROM users WHERE id = :id OR username = :username`,
            { id: '테스트', username: '테스트' },
            { outFormat: require('oracledb').OUT_FORMAT_OBJECT }
        );

        console.log('검색 결과:', result.rows);

        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log('\n사용자 정보:');
            console.log('ID:', user.ID);
            console.log('USERNAME:', user.USERNAME);
            console.log('EMAIL:', user.EMAIL);
            console.log('ROLE:', user.ROLE);
            console.log('PASSWORD (해시):', user.PASSWORD);
        } else {
            console.log('사용자를 찾을 수 없습니다.');
        }

    } catch (err) {
        console.error('오류:', err);
    } finally {
        if (connection) await connection.close();
    }
}

checkUser();
