const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Create tables
db.serialize(() => {
    // Table to store login tokens
    db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
            token TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            user_id TEXT,
            user_first_name TEXT,
            user_username TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Error creating tokens table', err.message);
    });

    // Table to store user information
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            referrer_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) console.error('Error creating users table', err.message);
    });

    // Table to track referrals
    db.run(`
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referrer_id TEXT NOT NULL,
            referred_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (referrer_id) REFERENCES users(id),
            FOREIGN KEY (referred_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) console.error('Error creating referrals table', err.message);
    });

    // Trigger to automatically update the 'updated_at' timestamp on user update
    db.run(`
        CREATE TRIGGER IF NOT EXISTS set_timestamp
        AFTER UPDATE ON users
        FOR EACH ROW
        BEGIN
            UPDATE users
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.id;
        END;
    `, (err) => {
        if (err) console.error('Error creating trigger', err.message);
    });

    // Table to store wheel spins
    db.run(`
        CREATE TABLE IF NOT EXISTS spins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            points INTEGER NOT NULL,
            spin_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) console.error('Error creating spins table', err.message);
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS withdraw_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            points INTEGER NOT NULL,
            solana_address TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            request_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) console.error('Error creating withdraw_requests table', err.message);
    });

    // Table to store store purchases
    db.run(`
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            item TEXT NOT NULL,
            points INTEGER NOT NULL,
            purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `, (err) => {
        if (err) console.error('Error creating purchases table', err.message);
    });
});

module.exports = db;
