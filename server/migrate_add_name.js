const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'wordtest.db');
const db = new Database(dbPath);

// Add name column if it doesn't exist
try {
    db.exec('ALTER TABLE users ADD COLUMN name TEXT');
    console.log('Added name column to users table');
} catch (err) {
    if (err.message.includes('duplicate column name')) {
        console.log('Name column already exists');
    } else {
        console.error('Error adding name column:', err.message);
    }
}

db.close();
console.log('Migration complete');
