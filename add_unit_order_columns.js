const { getConnection } = require('./db/dbConfig');

async function addColumns() {
    let connection;
    try {
        connection = await getConnection();

        // Check/Add UNIT_NAME
        const checkUnit = await connection.execute(
            `SELECT count(*) as count FROM user_tab_columns WHERE table_name = 'WORDS' AND column_name = 'UNIT_NAME'`
        );
        if (checkUnit.rows[0][0] === 0) {
            console.log('Adding UNIT_NAME column...');
            await connection.execute(`ALTER TABLE words ADD (unit_name VARCHAR2(100))`);
            console.log('UNIT_NAME column added.');
        } else {
            console.log('UNIT_NAME column already exists.');
        }

        // Check/Add WORD_ORDER
        const checkOrder = await connection.execute(
            `SELECT count(*) as count FROM user_tab_columns WHERE table_name = 'WORDS' AND column_name = 'WORD_ORDER'`
        );
        if (checkOrder.rows[0][0] === 0) {
            console.log('Adding WORD_ORDER column...');
            await connection.execute(`ALTER TABLE words ADD (word_order NUMBER)`);
            console.log('WORD_ORDER column added.');
        } else {
            console.log('WORD_ORDER column already exists.');
        }

        // Update existing records with defaults
        await connection.execute(`UPDATE words SET unit_name = '기본 단원' WHERE unit_name IS NULL`);
        await connection.execute(`UPDATE words SET word_order = id WHERE word_order IS NULL`);
        await connection.commit();
        console.log('Existing records updated.');

    } catch (err) {
        console.error('Error adding columns:', err);
    } finally {
        if (connection) await connection.close();
    }
}

addColumns();
