const admin = require('firebase-admin');
const { getConnection } = require('./db/dbConfig');
require('dotenv').config();

// Firebase 초기화
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateData() {
    let connection;
    try {
        connection = await getConnection();
        console.log('✅ Oracle DB 연결 성공');

        // 1. Users 마이그레이션
        console.log('\n📦 Users 마이그레이션 시작...');
        const usersSnapshot = await db.collection('users').get();
        let userCount = 0;

        for (const doc of usersSnapshot.docs) {
            const data = doc.data();
            try {
                await connection.execute(
                    `MERGE INTO users u
                     USING (SELECT :id as id FROM dual) d
                     ON (u.id = d.id)
                     WHEN NOT MATCHED THEN
                         INSERT (id, username, email, role, password)
                         VALUES (:id, :username, :email, :role, :password)`,
                    {
                        id: doc.id,
                        username: data.name || data.username || '사용자',
                        email: data.email || `${doc.id}@wordtest.com`,
                        role: data.role || 'student',
                        password: '1234' // 기본 비밀번호
                    },
                    { autoCommit: true }
                );
                userCount++;
            } catch (err) {
                console.error(`❌ User ${doc.id} 마이그레이션 실패:`, err.message);
            }
        }
        console.log(`✅ Users 마이그레이션 완료: ${userCount}개`);

        // 2. Words 마이그레이션
        console.log('\n📦 Words 마이그레이션 시작...');
        const wordsSnapshot = await db.collection('words').get();
        let wordCount = 0;

        for (const doc of wordsSnapshot.docs) {
            const data = doc.data();
            try {
                await connection.execute(
                    `INSERT INTO words (english, korean, level_group)
                     VALUES (:english, :korean, :level_group)`,
                    {
                        english: data.english || '',
                        korean: data.korean || '',
                        level_group: data.level_group || 1
                    },
                    { autoCommit: true }
                );
                wordCount++;
            } catch (err) {
                if (err.errorNum !== 1) { // ORA-00001: unique constraint violated는 무시
                    console.error(`❌ Word 마이그레이션 실패:`, err.message);
                }
            }
        }
        console.log(`✅ Words 마이그레이션 완료: ${wordCount}개`);

        // 3. Test Results 마이그레이션
        console.log('\n📦 Test Results 마이그레이션 시작...');
        const testResultsSnapshot = await db.collection('test_results').get();
        let testCount = 0;

        for (const doc of testResultsSnapshot.docs) {
            const data = doc.data();
            try {
                await connection.execute(
                    `INSERT INTO test_results (id, user_id, date_taken, score, total_questions, correct_answers, wrong_answers, details)
                     VALUES (:id, :user_id, TO_TIMESTAMP(:date_taken, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'), :score, :total, :correct, :wrong, :details)`,
                    {
                        id: doc.id,
                        user_id: data.user_id || '',
                        date_taken: data.date || new Date().toISOString(),
                        score: data.score || 0,
                        total: data.total || 0,
                        correct: data.correct || 0,
                        wrong: data.wrong || 0,
                        details: JSON.stringify(data.details || [])
                    },
                    { autoCommit: true }
                );
                testCount++;
            } catch (err) {
                if (err.errorNum !== 1) {
                    console.error(`❌ Test Result ${doc.id} 마이그레이션 실패:`, err.message);
                }
            }
        }
        console.log(`✅ Test Results 마이그레이션 완료: ${testCount}개`);

        // 4. Dollar History 마이그레이션
        console.log('\n📦 Dollar History 마이그레이션 시작...');
        const dollarSnapshot = await db.collection('dollar_history').get();
        let dollarCount = 0;

        for (const doc of dollarSnapshot.docs) {
            const data = doc.data();
            try {
                await connection.execute(
                    `INSERT INTO dollar_history (id, user_id, amount, reason, type, date_earned)
                     VALUES (:id, :user_id, :amount, :reason, :type, TO_TIMESTAMP(:date_earned, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'))`,
                    {
                        id: doc.id,
                        user_id: data.user_id || '',
                        amount: data.amount || 0,
                        reason: data.reason || '',
                        type: data.type || 'earned',
                        date_earned: data.date || new Date().toISOString()
                    },
                    { autoCommit: true }
                );
                dollarCount++;
            } catch (err) {
                if (err.errorNum !== 1) {
                    console.error(`❌ Dollar History ${doc.id} 마이그레이션 실패:`, err.message);
                }
            }
        }
        console.log(`✅ Dollar History 마이그레이션 완료: ${dollarCount}개`);

        console.log('\n🎉 모든 데이터 마이그레이션 완료!');
        console.log(`\n📊 요약:`);
        console.log(`   - Users: ${userCount}개`);
        console.log(`   - Words: ${wordCount}개`);
        console.log(`   - Test Results: ${testCount}개`);
        console.log(`   - Dollar History: ${dollarCount}개`);

    } catch (err) {
        console.error('❌ 마이그레이션 실패:', err);
    } finally {
        if (connection) await connection.close();
        process.exit(0);
    }
}

migrateData();
