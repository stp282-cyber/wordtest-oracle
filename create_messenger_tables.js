const { getConnection } = require('./db/dbConfig');

async function run() {
    let connection;

    try {
        connection = await getConnection();

        // Create CHATS table
        try {
            await connection.execute(`
                CREATE TABLE chats (
                    id VARCHAR2(50) PRIMARY KEY,
                    student_id VARCHAR2(50) NOT NULL,
                    teacher_id VARCHAR2(50) NOT NULL,
                    academy_id VARCHAR2(50),
                    last_message VARCHAR2(1000),
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    unread_student NUMBER DEFAULT 0,
                    unread_teacher NUMBER DEFAULT 0
                )
            `);
            console.log("Table 'chats' created.");
        } catch (err) {
            if (err.errorNum === 955) {
                console.log("Table 'chats' already exists.");
            } else {
                console.error("Error creating 'chats' table:", err);
            }
        }

        // Create MESSAGES table
        try {
            await connection.execute(`
                CREATE TABLE messages (
                    id VARCHAR2(50) PRIMARY KEY,
                    chat_id VARCHAR2(50) NOT NULL,
                    sender_id VARCHAR2(50) NOT NULL,
                    content CLOB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    read_at TIMESTAMP,
                    CONSTRAINT fk_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
                )
            `);
            console.log("Table 'messages' created.");
        } catch (err) {
            if (err.errorNum === 955) {
                console.log("Table 'messages' already exists.");
            } else {
                console.error("Error creating 'messages' table:", err);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (err) {
                console.error(err);
            }
        }
    }
}

run();
