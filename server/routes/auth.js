const express = require('express');
const router = express.Router();
const db = require('../db/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'secret-key';

// Register (Helper for initial setup)
router.post('/register', async (req, res) => {
    const { username, password, role, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare("INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)");
        const info = stmt.run(username, hashedPassword, role || 'student', name || null);

        // Initialize settings for student
        if (role !== 'admin') {
            const settingsStmt = db.prepare("INSERT INTO settings (user_id) VALUES (?)");
            settingsStmt.run(info.lastInsertRowid);
        }

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: '이미 존재하는 아이디입니다.' });
        }
        res.status(400).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '12h' });
    res.json({ token, role: user.role, username: user.username, name: user.name });
});

module.exports = router;
