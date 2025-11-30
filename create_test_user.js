const { getConnection } = require('./db/dbConfig');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createTestUser() {
    let connection;
    try {
        connection = await getConnection();
        const hashedPassword = await bcrypt.hash('1234', 10);

        const sql = `
            MERGE INTO users u
            USING (SELECT 'admin_test' as id FROM dual) d
            ON (u.id = d.id)
            WHEN MATCHED THEN
                UPDATE SET password = :password, role = 'admin', email = 'test@wordtest.com', username = 'TestAdmin'
            WHEN NOT MATCHED THEN
                INSERT (id, username, password, role, email)
                VALUES ('admin_test', 'TestAdmin', :password, 'admin', 'test@wordtest.com')
        `;

        await connection.execute(sql, [hashedPassword, hashedPassword], { autoCommit: true });
        console.log('Test user created: admin_test / 1234');
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}

createTestUser();
