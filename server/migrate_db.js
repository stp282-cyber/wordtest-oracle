const db = require('./db/database');

try {
    console.log("Adding class_id column to users table...");

    // Check if column already exists
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasClassId = columns.some(col => col.name === 'class_id');

    if (hasClassId) {
        console.log("class_id column already exists!");
    } else {
        db.prepare("ALTER TABLE users ADD COLUMN class_id INTEGER").run();
        console.log("Successfully added class_id column!");
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
