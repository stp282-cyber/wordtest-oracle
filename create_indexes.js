const { getConnection } = require('./db/dbConfig');
require('dotenv').config();

async function createIndexes() {
    let connection;
    try {
        connection = await getConnection();
        console.log('✅ DB 연결 성공');

        const indexes = [
            {
                name: 'idx_users_email',
                sql: `CREATE INDEX idx_users_email ON users(email)`,
                description: '사용자 이메일 인덱스 (로그인 성능 향상)'
            },
            {
                name: 'idx_words_book_number',
                sql: `CREATE INDEX idx_words_book_number ON words(book_name, word_number)`,
                description: '단어 책/번호 복합 인덱스 (단어 조회 성능 향상)'
            },
            {
                name: 'idx_test_results_user_date',
                sql: `CREATE INDEX idx_test_results_user_date ON test_results(user_id, date_taken)`,
                description: '시험 결과 사용자/날짜 복합 인덱스 (기록 조회 성능 향상)'
            },
            {
                name: 'idx_dollar_history_user_date',
                sql: `CREATE INDEX idx_dollar_history_user_date ON dollar_history(user_id, date_earned)`,
                description: '달러 히스토리 사용자/날짜 복합 인덱스 (보상 조회 성능 향상)'
            },
            {
                name: 'idx_chats_participants',
                sql: `CREATE INDEX idx_chats_participants ON chats(student_id, teacher_id)`,
                description: '채팅 참가자 복합 인덱스 (채팅 조회 성능 향상)'
            },
            {
                name: 'idx_messages_chat_created',
                sql: `CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at)`,
                description: '메시지 채팅/생성일 복합 인덱스 (메시지 조회 성능 향상)'
            }
        ];

        console.log('\n📊 인덱스 생성 시작...\n');

        for (const index of indexes) {
            try {
                await connection.execute(index.sql);
                console.log(`✅ ${index.name} 생성 완료`);
                console.log(`   ${index.description}\n`);
            } catch (err) {
                if (err.message.includes('ORA-00955')) {
                    console.log(`⚠️  ${index.name} 이미 존재함 (건너뜀)\n`);
                } else {
                    console.error(`❌ ${index.name} 생성 실패:`, err.message, '\n');
                }
            }
        }

        console.log('🎉 인덱스 생성 작업 완료!');

    } catch (err) {
        console.error('❌ DB 연결 실패:', err);
    } finally {
        if (connection) await connection.close();
    }
}

createIndexes();
