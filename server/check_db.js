const db = require('./db/database');

try {
    console.log("Checking tables...");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("Tables:", tables.map(t => t.name));

    console.log("\nChecking classes table schema...");
    const classesInfo = db.prepare("PRAGMA table_info(classes)").all();
    console.log("Classes columns:", classesInfo);

    console.log("\nChecking users table schema...");
    const usersInfo = db.prepare("PRAGMA table_info(users)").all();
    console.log("Users columns:", usersInfo);

    console.log("\nTesting student query...");
    const students = db.prepare(`
        SELECT u.id, u.username, u.class_id, c.name as class_name, s.current_word_index, s.words_per_session, s.book_name, s.study_days
        FROM users u 
        LEFT JOIN settings s ON u.id = s.user_id 
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.role = 'student'
    `).all();
    console.log("Students found:", students.length);
    if (students.length > 0) {
        console.log("First student:", students[0]);
    }

} catch (err) {
    console.error("Error:", err.message);
}
