const { getConnection } = require('./db/dbConfig');

async function deleteAllWords() {
    let connection;
    try {
        connection = await getConnection();

        const result = await connection.execute(
            `DELETE FROM words`,
            [],
            { autoCommit: true }
        );

        console.log(`삭제된 단어 수: ${result.rowsAffected}`);
        console.log('모든 단어가 삭제되었습니다.');

    } catch (err) {
        console.error('단어 삭제 오류:', err);
    } finally {
        if (connection) await connection.close();
    }
}

deleteAllWords();
