const oracledb = require('oracledb');
require('dotenv').config();
const { getConnection } = require('./db/dbConfig');

async function updateSchema() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        // classes 테이블 생성
        try {
            await connection.execute(`
                CREATE TABLE classes (
                    id VARCHAR2(50) PRIMARY KEY,
                    name VARCHAR2(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('classes 테이블 생성 완료');
        } catch (err) {
            if (err.message.includes('ORA-00955')) {
                console.log('classes 테이블이 이미 존재합니다.');
            } else {
                throw err;
            }
        }

        // users 테이블에 컬럼 추가 (class_id, curriculum_data)
        try {
            await connection.execute(`ALTER TABLE users ADD (class_id VARCHAR2(50))`);
            console.log('users 테이블에 class_id 컬럼 추가 완료');
        } catch (err) {
            if (err.message.includes('ORA-01430')) {
                console.log('users 테이블에 class_id 컬럼이 이미 존재합니다.');
            } else {
                console.error('class_id 컬럼 추가 실패 (무시 가능):', err.message);
            }
        }

        try {
            await connection.execute(`ALTER TABLE users ADD (curriculum_data CLOB)`);
            console.log('users 테이블에 curriculum_data 컬럼 추가 완료');
        } catch (err) {
            if (err.message.includes('ORA-01430')) {
                console.log('users 테이블에 curriculum_data 컬럼이 이미 존재합니다.');
            } else {
                console.error('curriculum_data 컬럼 추가 실패 (무시 가능):', err.message);
            }
        }

    } catch (err) {
        console.error('오류 발생:', err);
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

updateSchema();
