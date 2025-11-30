const oracledb = require('oracledb');
require('dotenv').config();
const { getConnection } = require('./db/dbConfig');

async function createAnnouncementsTable() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        // announcements 테이블 생성
        try {
            await connection.execute(`
                CREATE TABLE announcements (
                    id VARCHAR2(50) PRIMARY KEY,
                    title VARCHAR2(255) NOT NULL,
                    content CLOB,
                    target_class_id VARCHAR2(50),
                    target_class_name VARCHAR2(100),
                    author_name VARCHAR2(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('announcements 테이블 생성 완료');
        } catch (err) {
            if (err.message.includes('ORA-00955')) {
                console.log('announcements 테이블이 이미 존재합니다.');
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

createAnnouncementsTable();
