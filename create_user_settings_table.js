const oracledb = require('oracledb');
require('dotenv').config();
const { getConnection } = require('./db/dbConfig');

async function createUserSettingsTable() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        // user_settings 테이블 생성
        try {
            await connection.execute(`
                CREATE TABLE user_settings (
                    user_id VARCHAR2(50) PRIMARY KEY,
                    settings CLOB,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);
            console.log('user_settings 테이블 생성 완료');
        } catch (err) {
            if (err.message.includes('ORA-00955')) {
                console.log('user_settings 테이블이 이미 존재합니다.');
            } else {
                throw err;
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

createUserSettingsTable();
