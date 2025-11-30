const { getConnection } = require('./db/dbConfig');
require('dotenv').config();

async function checkUser() {
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.execute(
            `SELECT * FROM users WHERE id = '김태훈'`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        console.log('User Data:', result.rows);
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) await connection.close();
    }
}

const oracledb = require('oracledb');
checkUser();
