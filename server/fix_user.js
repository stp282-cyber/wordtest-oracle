const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'wordtest.db');
const db = new Database(dbPath);

// Fix the swapped username and name for user id 5
try {
    // Swap username and name for user id 5
    const stmt = db.prepare("UPDATE users SET username = ?, name = ? WHERE id = ?");
    const result = stmt.run('rlaxogns', '김태훈', 5);

    if (result.changes > 0) {
        console.log('Successfully fixed user id 5: username=rlaxogns, name=김태훈');
    }

    // Show all users
    const users = db.prepare("SELECT id, username, name, role FROM users").all();
    console.log('\nAll users after fix:');
    console.table(users);

} catch (err) {
    console.error('Error:', err.message);
}

db.close();
