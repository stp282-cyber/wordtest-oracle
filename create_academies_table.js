const { getConnection } = require('./db/dbConfig');

async function run() {
    let connection;

    try {
        connection = await getConnection();

        // Create ACADEMIES table
        try {
            await connection.execute(`
                CREATE TABLE academies (
                    id VARCHAR2(50) PRIMARY KEY,
                    name VARCHAR2(100) NOT NULL,
                    logo_text VARCHAR2(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log("Table 'academies' created.");
        } catch (err) {
            if (err.errorNum === 955) {
                console.log("Table 'academies' already exists.");
            } else {
                console.error("Error creating 'academies' table:", err);
            }
        }

        // Insert default academy if not exists
        try {
            await connection.execute(`
                MERGE INTO academies a
                USING (SELECT 'academy_default' AS id, 'Eastern WordTest' AS name FROM dual) src
                ON (a.id = src.id)
                WHEN NOT MATCHED THEN INSERT (id, name) VALUES (src.id, src.name)
            `, {}, { autoCommit: true });
            console.log("Default academy ensured.");
        } catch (err) {
            console.error("Error inserting default academy:", err);
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
