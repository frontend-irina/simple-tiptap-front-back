import { pool } from "./db.js";

await pool.query(`
  CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY,
    title varchar(200) NOT NULL,
    blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS documents_updated_at_idx ON documents (updated_at DESC);
`);
console.log("Database migration completed");
await pool.end();
