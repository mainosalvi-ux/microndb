const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false,
});

// Función query interceptora y adaptadora global para el Frontend
async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    
    // PARCHE GLOBAL: Si la consulta devuelve filas con la columna 'fields', 
    // las convertimos a texto para que el JSON.parse del Frontend no rompa la interfaz
    if (res.rows && res.rows.length > 0) {
      res.rows.forEach(row => {
        if (row && row.fields !== undefined && typeof row.fields === 'object' && row.fields !== null) {
          row.fields = JSON.stringify(row.fields);
        }
      });
    }
    
    return res;
  } finally {
    client.release();
  }
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      nation_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS nations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color_idx INTEGER DEFAULT 0,
      fields JSONB NOT NULL DEFAULT '[]',
      join_token TEXT UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      nation_id TEXT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}',
      source TEXT DEFAULT 'user',
      citizen_number INTEGER,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      nation_id TEXT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
      uploaded_by TEXT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mimetype TEXT,
      size INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await query(`
    CREATE OR REPLACE FUNCTION set_citizen_number()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.source = 'citizen' AND NEW.citizen_number IS NULL THEN
        SELECT COALESCE(MAX(citizen_number), 0) + 1
        INTO NEW.citizen_number
        FROM records
        WHERE nation_id = NEW.nation_id AND source = 'citizen';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await query(`
    DROP TRIGGER IF EXISTS citizen_number_trigger ON records;
    CREATE TRIGGER citizen_number_trigger
    BEFORE INSERT ON records
    FOR EACH ROW EXECUTE FUNCTION set_citizen_number();
  `);
}

module.exports = { pool, query, initSchema };
