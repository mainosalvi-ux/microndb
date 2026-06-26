const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/micronation.sqlite');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      nation_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS nations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color_idx INTEGER DEFAULT 0,
      fields TEXT NOT NULL DEFAULT '[]',
      join_token TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      nation_id TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      source TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Add join_token column if upgrading from old db
  try { db.run(`ALTER TABLE nations ADD COLUMN join_token TEXT`); } catch(e) {}
  try { db.run(`ALTER TABLE records ADD COLUMN source TEXT DEFAULT 'user'`); } catch(e) {}
  persist();
  return db;
}

function persist() {
  if (!db) return;
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return query(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

module.exports = { getDb, query, queryOne, run, persist };
