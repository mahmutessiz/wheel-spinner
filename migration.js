const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error('Error opening database', err.message);
    }
    console.log('Connected to the SQLite database for migration.');
});

db.serialize(() => {
    console.log('Starting migration to remove referral_code column (v2)...');

    db.run("BEGIN TRANSACTION;", (err) => {
        if (err) {
            console.error("Failed to begin transaction:", err.message);
            db.close();
            return;
        }
    });

    // Create the new table with the correct final schema
    db.run("CREATE TABLE users_new (id TEXT PRIMARY KEY, username TEXT, first_name TEXT, last_name TEXT, referrer_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (referrer_id) REFERENCES users(id));", (err) => {
        if (err) {
            console.error("Migration failed: Could not create new table.", err.message);
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 1/4: New temporary table created.");
    });

    // Copy data from the old table, only selecting columns that are guaranteed to exist.
    db.run("INSERT INTO users_new (id, username, first_name, last_name, created_at, updated_at) SELECT id, username, first_name, last_name, created_at, updated_at FROM users;", (err) => {
        if (err) {
            console.error("Migration failed: Could not copy data.", err.message);
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 2/4: User data copied to new table.");
    });

    db.run("DROP TABLE users;", (err) => {
        if (err) {
            console.error("Migration failed: Could not drop old table.", err.message);
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 3/4: Old users table dropped.");
    });

    db.run("ALTER TABLE users_new RENAME TO users;", (err) => {
        if (err) {
            console.error("Migration failed: Could not rename new table.", err.message);
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 4/4: New table renamed to 'users'.");
    });

    db.run("COMMIT;", (err) => {
        if (err) {
            console.error("Failed to commit transaction:", err.message);
        } else {
            console.log("\nMigration completed successfully!");
        }
        db.close((closeErr) => {
            if (closeErr) {
                console.error(closeErr.message);
            }
            console.log('Database connection closed.');
        });
    });
});
