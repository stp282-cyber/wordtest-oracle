const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'wordtest.db');
const db = new Database(dbPath);

// Update name for rlaxogns user
try {
    const stmt = db.prepare("UPDATE users SET name = ? WHERE username = ?");
    const result = stmt.run('김태훈', 'rlaxogns');

    if (result.changes > 0) {
        console.log('Successfully updated name for rlaxogns to 김태훈');
    } else {
        console.log('User rlaxogns not found');
    }

    // Also update student account if it exists
    const studentStmt = db.prepare("UPDATE users SET name = ? WHERE username = ?");
    const studentResult = studentStmt.run('학생', 'student');

    if (studentResult.changes > 0) {
        console.log('Successfully updated name for student to 학생');
    }

    // Show all users
    const users = db.prepare("SELECT id, username, name, role FROM users").all();
    console.log('\nAll users:');
    console.table(users);

} catch (err) {
    console.error('Error:', err.message);
}

db.close();
