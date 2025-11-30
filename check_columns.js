const { getConnection } = require('./db/dbConfig');

async function checkColumns() {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT column_name FROM user_tab_columns WHERE table_name = 'WORDS'`
        );
        console.log('Columns in WORDS table:', result.rows);
    } catch (err) {
        console.error('Error checking columns:', err);
    } finally {
        if (connection) await connection.close();
    }
}

checkColumns();
