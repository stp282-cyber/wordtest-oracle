const db = require('./db/database');
const bcrypt = require('bcryptjs');

async function resetStudent() {
    const password = 'student123';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        db.prepare("UPDATE users SET password = ? WHERE username = 'student'").run(hashedPassword);
        console.log("Student password reset to: student123");
    } catch (e) {
        console.error("Error resetting password:", e);
    }
}

resetStudent();
