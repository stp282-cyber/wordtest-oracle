const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'wordtest.db');
const db = new Database(dbPath);

// Add new columns to test_results table
const columnsToAdd = [
    { name: 'scheduled_date', type: 'TEXT' },
    { name: 'test_type', type: 'TEXT' },
    { name: 'first_attempt_score', type: 'INTEGER' },
    { name: 'retry_count', type: 'INTEGER DEFAULT 0' },
    { name: 'completed', type: 'INTEGER DEFAULT 0' }
];

columnsToAdd.forEach(col => {
    try {
        db.exec(`ALTER TABLE test_results ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Added ${col.name} column to test_results table`);
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log(`${col.name} column already exists`);
        } else {
            console.error(`Error adding ${col.name} column:`, err.message);
        }
    }
});

// Create absences table for tracking student absences
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            absence_date TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);
    console.log('Created absences table');
} catch (err) {
    console.log('Absences table already exists or error:', err.message);
}

db.close();
console.log('Migration complete');
