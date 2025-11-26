const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'wordtest.db');
const db = new Database(dbPath, { verbose: console.log });

// Initialize Schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
} else {
    // Define schema inline if file doesn't exist yet (or we can create schema.sql separately)
    // For now, let's define it here or call a function
    initSchema();
}

function initSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS classes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('student', 'admin')) NOT NULL,
            class_id INTEGER,
            FOREIGN KEY(class_id) REFERENCES classes(id)
        );

        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_name TEXT DEFAULT '기본',
            word_number INTEGER,
            english TEXT NOT NULL,
            korean TEXT NOT NULL,
            level INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS settings (
            user_id INTEGER PRIMARY KEY,
            current_word_index INTEGER DEFAULT 0,
            words_per_session INTEGER DEFAULT 10,
            book_name TEXT DEFAULT '기본',
            study_days TEXT DEFAULT '1,2,3,4,5',
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS test_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT DEFAULT CURRENT_TIMESTAMP,
            score INTEGER NOT NULL,
            details TEXT, -- JSON string of results
            range_start INTEGER,
            range_end INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    `);

    // Seed Admin if not exists
    const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
    if (!admin) {
        // Default admin: admin/admin123 (In production, hash this!)
        // For simplicity in this prototype, we'll store plain text or simple hash. 
        // Let's use bcrypt in the auth route, but here we might need to hash it if we seed it.
        // We will handle seeding in a separate script or just check here.
        // For now, let's assume the auth route handles registration or we manually insert.
        console.log("No admin found. Please register or seed the database.");
    }
}

module.exports = db;
