const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'wordtest.db');
const db = new Database(dbPath);

async function updateAdminCredentials() {
    try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash('rudwls83', 10);

        // Update admin username and password
        const stmt = db.prepare("UPDATE users SET username = ?, password = ? WHERE role = 'admin'");
        const result = stmt.run('stp282', hashedPassword);

        if (result.changes > 0) {
            console.log('Successfully updated admin credentials');
            console.log('New username: stp282');
            console.log('New password: rudwls83');
        } else {
            console.log('No admin user found');
        }

        // Show all admin users
        const admins = db.prepare("SELECT id, username, role FROM users WHERE role = 'admin'").all();
        console.log('\nAdmin users:');
        console.table(admins);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

updateAdminCredentials().then(() => {
    db.close();
    console.log('\nUpdate complete!');
});
