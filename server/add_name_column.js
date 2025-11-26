const db = require('./db/database');

try {
    console.log("Adding name column to users table...");

    // Check if column already exists
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasName = columns.some(col => col.name === 'name');

    if (hasName) {
        console.log("name column already exists!");
    } else {
        db.prepare("ALTER TABLE users ADD COLUMN name TEXT").run();
        console.log("Successfully added name column!");
    }

    // Verify
    const updatedColumns = db.prepare("PRAGMA table_info(users)").all();
    console.log("\nUpdated users table columns:");
    updatedColumns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });

} catch (err) {
    console.error("Error:", err.message);
}
