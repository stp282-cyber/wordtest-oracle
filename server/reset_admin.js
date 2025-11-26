const db = require('./db/database');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        db.prepare("UPDATE users SET password = ? WHERE username = 'admin'").run(hashedPassword);
        console.log("Admin password reset to: admin123");
    } catch (e) {
        console.error("Error resetting password:", e);
    }
}

resetAdmin();
