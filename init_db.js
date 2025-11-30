const fs = require('fs');
const path = require('path');
const { getConnection } = require('./db/dbConfig');

async function initDb() {
    let connection;
    try {
        connection = await getConnection();
        console.log('✅ DB 연결 성공 (초기화 시작)');

        const sqlPath = path.join(__dirname, 'db', 'schema.sql');
        const sqlScript = fs.readFileSync(sqlPath, 'utf8');

        // 세미콜론으로 구문 분리 (간이 파서)
        const statements = sqlScript.split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const sql of statements) {
            try {
                await connection.execute(sql);
                console.log('실행 완료:', sql.substring(0, 50).replace(/\n/g, ' ') + '...');
            } catch (err) {
                // ORA-00955: name is already used by an existing object
                if (err.errorNum === 955) {
                    console.log('⚠️ 테이블이 이미 존재합니다 (건너뜀):', sql.substring(0, 30) + '...');
                } else {
                    console.error('❌ SQL 실행 오류:', err.message);
                    console.error('SQL:', sql);
                }
            }
        }

        console.log('🎉 데이터베이스 초기화 완료!');

    } catch (err) {
        console.error('❌ 초기화 실패:', err);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error('연결 종료 오류:', err);
            }
        }
    }
}

initDb();
