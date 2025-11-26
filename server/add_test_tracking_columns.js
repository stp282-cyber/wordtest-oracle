const db = require('./db/database');

try {
    console.log("Adding new columns to test_results table...");

    const columns = db.prepare("PRAGMA table_info(test_results)").all();
    const columnNames = columns.map(col => col.name);

    // Add first_attempt_score
    if (!columnNames.includes('first_attempt_score')) {
        db.prepare("ALTER TABLE test_results ADD COLUMN first_attempt_score INTEGER").run();
        console.log("✓ Added first_attempt_score column");
    } else {
        console.log("✓ first_attempt_score column already exists");
    }

    // Add retry_count
    if (!columnNames.includes('retry_count')) {
        db.prepare("ALTER TABLE test_results ADD COLUMN retry_count INTEGER DEFAULT 0").run();
        console.log("✓ Added retry_count column");
    } else {
        console.log("✓ retry_count column already exists");
    }

    // Add test_type
    if (!columnNames.includes('test_type')) {
        db.prepare("ALTER TABLE test_results ADD COLUMN test_type TEXT").run();
        console.log("✓ Added test_type column");
    } else {
        console.log("✓ test_type column already exists");
    }

    // Add completed
    if (!columnNames.includes('completed')) {
        db.prepare("ALTER TABLE test_results ADD COLUMN completed INTEGER DEFAULT 0").run();
        console.log("✓ Added completed column");
    } else {
        console.log("✓ completed column already exists");
    }

    // Verify
    const updatedColumns = db.prepare("PRAGMA table_info(test_results)").all();
    console.log("\n✓ Updated test_results table columns:");
    updatedColumns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });

} catch (err) {
    console.error("Error:", err.message);
}
