const oracledb = require('oracledb');
require('dotenv').config();
const { getConnection } = require('./db/dbConfig');

async function createSettingsTable() {
    let connection;
    try {
        connection = await getConnection();
        console.log('DB 연결 성공');

        // settings 테이블 생성
        try {
            await connection.execute(`
                CREATE TABLE settings (
                    key VARCHAR2(100) PRIMARY KEY,
                    value CLOB
                )
            `);
            console.log('settings 테이블 생성 완료');
        } catch (err) {
            if (err.message.includes('ORA-00955')) {
                console.log('settings 테이블이 이미 존재합니다.');
            } else {
                throw err;
            }
        }

        // 초기 데이터 삽입 (기본값)
        const defaultSettings = {
            daily_completion_reward: 0.5,
            curriculum_completion_reward: 0.1,
            game_high_score_reward: 0.05,
            game_high_score_threshold: 80,
            game_daily_max_reward: 0.5
        };

        await connection.execute(
            `MERGE INTO settings s
             USING (SELECT :key AS key, :value AS value FROM dual) src
             ON (s.key = src.key)
             WHEN MATCHED THEN UPDATE SET value = src.value
             WHEN NOT MATCHED THEN INSERT (key, value) VALUES (src.key, src.value)`,
            {
                key: 'rewards_academy_default',
                value: JSON.stringify(defaultSettings)
            },
            { autoCommit: true }
        );
        console.log('기본 설정 데이터 초기화 완료');

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

createSettingsTable();
