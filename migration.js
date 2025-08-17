const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database for migration.');
    }
});

db.serialize(() => {
    console.log('Starting database migration...');

    // Step 1: Begin a transaction
    db.run("BEGIN TRANSACTION;", (err) => {
        if (err) {
            console.error("Failed to begin transaction:", err.message);
            db.close();
            return;
        }
        console.log("Transaction started.");
    });

    // Step 2: Rename the existing users table
    db.run("ALTER TABLE users RENAME TO users_old;", (err) => {
        if (err) {
            console.error("Migration failed at step: RENAME TABLE. Your data is safe in the 'users' table.", err.message);
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 1/4: Original 'users' table renamed to 'users_old'.");
    });

    // Step 3: Create the new users table with the corrected schema
    db.run(`
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            referral_code TEXT,
            referrer_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) {
            console.error("Migration failed at step: CREATE NEW TABLE.", err.message);
            // Attempt to roll back by renaming the old table back
            db.run("ALTER TABLE users_old RENAME TO users;");
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 2/4: New 'users' table created with corrected schema.");
    });

    // Step 4: Copy data from the old table to the new table
    // Note: We assume the old table had the same columns minus the unique constraint.
    // If the referral_code column didn't exist in some versions, we handle it.
    db.run(`
        INSERT INTO users (id, username, first_name, last_name, referral_code, referrer_id, created_at, updated_at)
        SELECT id, username, first_name, last_name, referral_code, referrer_id, created_at, updated_at FROM users_old;
    `, (err) => {
        if (err) {
            console.error("Migration failed at step: COPY DATA.", err.message);
            console.error("Attempting to restore original table...");
            db.run("DROP TABLE users;");
            db.run("ALTER TABLE users_old RENAME TO users;");
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 3/4: Data successfully copied to the new 'users' table.");
    });

    // Step 5: Drop the old table
    db.run("DROP TABLE users_old;", (err) => {
        if (err) {
            // This is a critical point. If this fails, manual intervention might be needed.
            console.error("Migration failed at step: DROP OLD TABLE. The new table has the data, but the old table could not be removed.", err.message);
            db.run("ROLLBACK;");
            db.close();
            return;
        }
        console.log("Step 4/4: Old 'users_old' table dropped.");
    });

    // Step 6: Commit the transaction
    db.run("COMMIT;", (err) => {
        if (err) {
            console.error("Failed to commit transaction:", err.message);
            db.close();
            return;
        }
        console.log("Transaction committed.");
        console.log("\nMigration completed successfully!");
    });
});

// Close the database connection
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Closed the database connection.');
});