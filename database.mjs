import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const verboseSqlite = sqlite3.verbose();
const dbPath = path.resolve(__dirname, "plinkoverse.db");

const db = new verboseSqlite.Database(dbPath, (err) => {
  if (err) {
    // eslint-disable-next-line no-undef
    console.error("Error opening database " + dbPath + ": " + err.message);
  } else {
    // eslint-disable-next-line no-undef
    console.log("Connected to the SQLite database.");
  }
});

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        balance REAL DEFAULT 0,
        kyc_status TEXT DEFAULT 'unverified',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        // Migration: Add missing columns if they don't exist
        db.run("ALTER TABLE users ADD COLUMN phone TEXT", (err) => {});
        db.run("ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0", (err) => {});
        db.run("ALTER TABLE users ADD COLUMN kyc_level INTEGER DEFAULT 0", (err) => {});
    });

  // Transactions/Claims table
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        type TEXT, -- 'claim', 'win', 'loss', 'airdrop'
        amount REAL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Export bound methods for easier destructuring in server.js
export const run = (sql, params, callback) => db.run(sql, params, callback);
export const get = (sql, params, callback) => db.get(sql, params, callback);
export const all = (sql, params, callback) => db.all(sql, params, callback);
export const serialize = (callback) => db.serialize(callback);

export default db;
