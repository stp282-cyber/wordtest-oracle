const express = require('express');
const router = express.Router();
const db = require('../db/database');

// Get all students
router.get('/students', (req, res) => {
    const students = db.prepare(`
        SELECT u.id, u.username, u.name, u.class_id, c.name as class_name, s.current_word_index, s.words_per_session, s.book_name, s.study_days
        FROM users u 
        LEFT JOIN settings s ON u.id = s.user_id 
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'student'
    `).all();
    res.json(students);
});

// Get student results
router.get('/students/:id/results', (req, res) => {
    const results = db.prepare("SELECT * FROM test_results WHERE user_id = ? ORDER BY date DESC").all(req.params.id);
    res.json(results);
});

// Get all words
router.get('/words', (req, res) => {
    try {
        const words = db.prepare("SELECT * FROM words ORDER BY book_name, word_number").all();
        res.json(words);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add words
router.post('/words', (req, res) => {
    const { words } = req.body;
    console.log(`Received ${words.length} words to insert`);

    const insert = db.prepare("INSERT INTO words (book_name, word_number, english, korean, level) VALUES (?, ?, ?, ?, ?)");
    const insertMany = db.transaction((wordsArray) => {
        for (const word of wordsArray) {
            try {
                const bookName = String(word.book_name || word.단어장명 || '기본');
                const wordNumber = word.word_number || word.번호;
                const english = String(word.english || word.영어 || word.영단어 || '');
                const korean = String(word.korean || word.한글 || word.뜻 || '');
                const level = word.level || 1;

                if (!english || !korean || english === 'undefined' || korean === 'undefined') {
                    console.log('Skipping invalid word:', word);
                    continue;
                }

                insert.run(
                    bookName,
                    wordNumber ? parseInt(wordNumber) : null,
                    english,
                    korean,
                    level
                );
            } catch (err) {
                console.error('Error inserting word:', word, err.message);
                throw err;
            }
        }
    });

    try {
        insertMany(words);
        console.log(`Successfully inserted words`);
        res.json({ success: true, count: words.length });
    } catch (err) {
        console.error('Transaction error:', err.message);
        res.status(400).json({ error: err.message });
    }
});

// Delete word
router.delete('/words/:id', (req, res) => {
    try {
        db.prepare("DELETE FROM words WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update student progress
router.put('/students/:id/progress', (req, res) => {
    const { current_word_index } = req.body;
    try {
        db.prepare("UPDATE settings SET current_word_index = ? WHERE user_id = ?").run(current_word_index, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update student settings
router.put('/students/:id/settings', (req, res) => {
    const { book_name, study_days, words_per_session, current_word_index } = req.body;
    try {
        const updates = [];
        const values = [];

        if (book_name !== undefined) {
            updates.push('book_name = ?');
            values.push(book_name);
        }
        if (study_days !== undefined) {
            updates.push('study_days = ?');
            values.push(study_days);
        }
        if (words_per_session !== undefined) {
            updates.push('words_per_session = ?');
            values.push(words_per_session);
        }
        if (current_word_index !== undefined) {
            updates.push('current_word_index = ?');
            values.push(current_word_index);
        }

        if (updates.length > 0) {
            values.push(req.params.id);
            const query = `UPDATE settings SET ${updates.join(', ')} WHERE user_id = ?`;
            db.prepare(query).run(...values);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete student
router.delete('/students/:id', (req, res) => {
    try {
        db.prepare("DELETE FROM settings WHERE user_id = ?").run(req.params.id);
        db.prepare("DELETE FROM test_results WHERE user_id = ?").run(req.params.id);
        db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all classes
router.get('/classes', (req, res) => {
    try {
        const classes = db.prepare("SELECT * FROM classes ORDER BY name").all();
        res.json(classes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create class
router.post('/classes', (req, res) => {
    const { name } = req.body;
    try {
        const result = db.prepare("INSERT INTO classes (name) VALUES (?)").run(name);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete class
router.delete('/classes/:id', (req, res) => {
    try {
        // Optional: Check if students are assigned to this class before deleting
        // For now, just set their class_id to NULL
        db.prepare("UPDATE users SET class_id = NULL WHERE class_id = ?").run(req.params.id);
        db.prepare("DELETE FROM classes WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Assign student to class
router.put('/students/:id/class', (req, res) => {
    const { class_id } = req.body;
    try {
        db.prepare("UPDATE users SET class_id = ? WHERE id = ?").run(class_id, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
