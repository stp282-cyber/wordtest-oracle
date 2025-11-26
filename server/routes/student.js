// server/routes/student.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get Dashboard Data
router.get('/dashboard', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    const history = db.prepare('SELECT date, score FROM test_results WHERE user_id = ?').all(userId);

    res.json({ settings, history });
});

// Get Study History
router.get('/history', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const history = db.prepare(`
      SELECT date, score, details
      FROM test_results
      WHERE user_id = ?
      ORDER BY date DESC
    `).all(userId);

        const formattedHistory = history.map(record => {
            let details = [];
            try { details = JSON.parse(record.details); } catch (e) { console.error("Failed to parse details JSON", e); }
            const total = details.length;
            const correct = details.filter(d => d.correct).length;
            const wrong = total - correct;
            const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
            return {
                date: record.date,
                score: record.score,
                percent,
                total,
                correct,
                wrong,
                details: details.map(d => ({
                    questionNumber: d.word?.word_number || '?',
                    questionName: d.word?.english || '?',
                    questionType: d.word?.korean ? '주관식' : '객관식',
                    isCorrect: d.correct,
                    userAnswer: d.userAnswer
                }))
            };
        });
        res.json({ history: formattedHistory });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Get test (words for current session)
router.get('/test', (req, res) => {
    const userId = req.query.userId;
    const customStartIndex = req.query.startIndex ? parseInt(req.query.startIndex) : null;
    const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
    if (!settings) return res.status(404).json({ error: 'Settings not found' });

    const { current_word_index, words_per_session, book_name } = settings;

    // Get all words from the assigned book, ordered by word_number
    const allWords = db.prepare(`
    SELECT * FROM words
    WHERE book_name = ?
    ORDER BY word_number ASC, id ASC
  `).all(book_name || '기본');

    if (allWords.length === 0) {
        return res.json({
            words: [],
            newWords: [],
            reviewWords: [],
            rangeStart: current_word_index,
            rangeEnd: current_word_index,
            message: '선택한 단어장에 단어가 없습니다.'
        });
    }

    // Determine start word number
    const startWordNumber = customStartIndex !== null ? customStartIndex : (current_word_index || 0) + 1;
    const endWordNumber = startWordNumber + words_per_session;

    // New words for this session
    const newWords = allWords.filter(w => w.word_number >= startWordNumber && w.word_number < endWordNumber);

    // Review words (previous two sessions)
    const reviewStartWordNumber = Math.max(1, startWordNumber - (words_per_session * 2));
    const reviewEndWordNumber = startWordNumber;
    const reviewWords = allWords.filter(w => w.word_number >= reviewStartWordNumber && w.word_number < reviewEndWordNumber);

    const allStudyWords = [...newWords, ...reviewWords];
    const rangeStart = newWords.length > 0 ? newWords[0].word_number : startWordNumber;
    const rangeEnd = newWords.length > 0 ? newWords[newWords.length - 1].word_number : startWordNumber;

    res.json({
        words: allStudyWords,
        newWords,
        reviewWords,
        rangeStart,
        rangeEnd
    });
});

// Submit test results
router.post('/test/submit', (req, res) => {
    const { userId, score, details, rangeStart, rangeEnd, firstAttemptScore, retryCount, testType, completed } = req.body;
    const insert = db.prepare(`
    INSERT INTO test_results (user_id, score, details, range_start, range_end, first_attempt_score, retry_count, test_type, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    try {
        insert.run(
            userId,
            score,
            JSON.stringify(details),
            rangeStart,
            rangeEnd,
            firstAttemptScore || score,
            retryCount || 0,
            testType || 'new_words',
            completed ? 1 : 0
        );
        // Update current_word_index
        const newIndex = rangeEnd;
        db.prepare('UPDATE settings SET current_word_index = ? WHERE user_id = ?').run(newIndex, userId);
        res.json({ success: true, newWordIndex: newIndex });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
