const { getConnection } = require('./db/dbConfig');

async function addBookNameColumn() {
    let connection;
    try {
        connection = await getConnection();

        // Check if column exists first
        const checkResult = await connection.execute(
            `SELECT count(*) as count FROM user_tab_columns WHERE table_name = 'WORDS' AND column_name = 'BOOK_NAME'`
        );

        if (checkResult.rows[0][0] === 0) {
            console.log('Adding BOOK_NAME column...');
            await connection.execute(
                `ALTER TABLE words ADD (book_name VARCHAR2(100))`
            );
            console.log('BOOK_NAME column added successfully.');

            // Optional: Update existing records to have a default book name
            await connection.execute(
                `UPDATE words SET book_name = '기본 단어장' WHERE book_name IS NULL`
            );
            await connection.commit();
            console.log('Existing records updated with default book name.');
        } else {
            console.log('BOOK_NAME column already exists.');
        }

    } catch (err) {
        console.error('Error adding column:', err);
    } finally {
        if (connection) await connection.close();
    }
}

addBookNameColumn();
