import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * 테스트 결과를 daily summary에 추가
 * @param {string} userId - 사용자 ID
 * @param {object} testData - 테스트 데이터
 * @returns {Promise<boolean>} 성공 여부
 */
export async function addTestToSummary(userId, testData) {
    const date = testData.date || new Date().toISOString().split('T')[0];
    const summaryRef = doc(db, 'student_daily_summaries', `${userId}_${date}`);

    try {
        // 기존 summary 가져오기
        const summaryDoc = await getDoc(summaryRef);
        const existing = summaryDoc.exists() ? summaryDoc.data() : null;

        // 새 테스트 데이터
        const newTest = {
            time: new Date().toISOString(),
            score: testData.score || 0,
            correct: testData.correct || 0,
            total: testData.total || 0,
            book: testData.book_name || '',
            mode: testData.test_mode || 'word_typing',
            rangeStart: testData.range_start || 0,
            rangeEnd: testData.range_end || 0
        };

        // 기존 테스트 배열에 추가
        const tests = existing?.tests || [];
        const allTests = [...tests, newTest];

        // 집계 계산
        const summary = {
            totalTests: allTests.length,
            totalScore: allTests.reduce((sum, t) => sum + (t.score || 0), 0),
            totalCorrect: allTests.reduce((sum, t) => sum + (t.correct || 0), 0),
            totalQuestions: allTests.reduce((sum, t) => sum + (t.total || 0), 0),
            booksStudied: [...new Set(allTests.map(t => t.book).filter(b => b))]
        };

        // 평균 점수 계산
        summary.averageScore = summary.totalTests > 0
            ? Math.round(summary.totalScore / summary.totalTests)
            : 0;

        // 정확도 계산
        summary.accuracy = summary.totalQuestions > 0
            ? Math.round((summary.totalCorrect / summary.totalQuestions) * 100)
            : 0;

        // Firestore에 저장
        await setDoc(summaryRef, {
            userId,
            date,
            academyId: testData.academyId || localStorage.getItem('academyId') || 'academy_default',
            summary,
            tests: allTests,
            updatedAt: serverTimestamp(),
            ...(existing ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });

        console.log(`✅ Daily summary updated for ${userId} on ${date}:`, summary);
        return true;
    } catch (error) {
        console.error('❌ Error updating daily summary:', error);
        return false;
    }
}

/**
 * 달러 거래를 daily summary에 추가
 * @param {string} userId - 사용자 ID
 * @param {object} dollarData - 달러 거래 데이터
 * @returns {Promise<boolean>} 성공 여부
 */
export async function addDollarToSummary(userId, dollarData) {
    const date = dollarData.date || new Date().toISOString().split('T')[0];
    const summaryRef = doc(db, 'student_daily_summaries', `${userId}_${date}`);

    try {
        const summaryDoc = await getDoc(summaryRef);
        const existing = summaryDoc.exists() ? summaryDoc.data() : null;

        const currentDollars = existing?.dollars || { earned: 0, spent: 0, balance: 0, transactions: [] };

        const newTransaction = {
            time: new Date().toISOString(),
            amount: dollarData.amount || 0,
            type: dollarData.type || 'earn',
            reason: dollarData.reason || ''
        };

        const transactions = [...(currentDollars.transactions || []), newTransaction];

        const dollars = {
            earned: currentDollars.earned + (dollarData.type === 'earn' ? dollarData.amount : 0),
            spent: currentDollars.spent + (dollarData.type === 'spend' ? dollarData.amount : 0),
            transactions
        };

        dollars.balance = dollars.earned - dollars.spent;

        await setDoc(summaryRef, {
            userId,
            date,
            academyId: dollarData.academyId || localStorage.getItem('academyId') || 'academy_default',
            dollars,
            updatedAt: serverTimestamp(),
            ...(existing ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });

        console.log(`✅ Dollar transaction added for ${userId} on ${date}`);
        return true;
    } catch (error) {
        console.error('❌ Error adding dollar transaction:', error);
        return false;
    }
}

/**
 * 최근 N일의 summary 조회
 * @param {string} userId - 사용자 ID
 * @param {number} days - 조회할 일수 (기본 30일)
 * @returns {Promise<Array>} summary 배열
 */
export async function getRecentSummaries(userId, days = 30) {
    const summaries = [];
    const promises = [];

    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const date = d.toISOString().split('T')[0];

        promises.push(
            getDoc(doc(db, 'student_daily_summaries', `${userId}_${date}`))
        );
    }

    try {
        const docs = await Promise.all(promises);
        docs.forEach(docSnap => {
            if (docSnap.exists()) {
                summaries.push({ id: docSnap.id, ...docSnap.data() });
            }
        });

        console.log(`✅ Loaded ${summaries.length} daily summaries for ${userId}`);
        return summaries;
    } catch (error) {
        console.error('❌ Error fetching recent summaries:', error);
        return [];
    }
}

/**
 * Summary를 history 형식으로 변환
 * @param {Array} summaries - summary 배열
 * @returns {Array} history 배열
 */
export function summariesToHistory(summaries) {
    const history = summaries.flatMap(summary =>
        (summary.tests || []).map(test => ({
            date: summary.date,
            time: test.time,
            score: test.score,
            correct: test.correct,
            total: test.total,
            book_name: test.book,
            test_mode: test.mode,
            range_start: test.rangeStart,
            range_end: test.rangeEnd,
            scheduled_date: summary.date
        }))
    );

    // 시간순 정렬 (최신순)
    history.sort((a, b) => new Date(b.time) - new Date(a.time));

    return history;
}
