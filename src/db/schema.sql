CREATE TABLE IF NOT EXISTS hats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  image_file TEXT,
  notes      TEXT,
  retired_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hats_name ON hats(name);

CREATE TABLE IF NOT EXISTS washes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  hat_id     INTEGER NOT NULL REFERENCES hats(id) ON DELETE CASCADE,
  washed_at  INTEGER NOT NULL,
  notes      TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_washes_hat_id ON washes(hat_id);
CREATE INDEX IF NOT EXISTS idx_washes_washed_at ON washes(washed_at);
