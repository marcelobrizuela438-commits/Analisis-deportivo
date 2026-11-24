CREATE TABLE picks (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pick','parley')),
  date TEXT NOT NULL,
  stake_cents INTEGER NOT NULL CHECK (stake_cents > 0),
  odds REAL NOT NULL CHECK (odds >= 1),
  status TEXT NOT NULL CHECK (status IN ('pendiente','acertado','errado','anulado')),
  selections TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX picks_user_date ON picks(user_id, date DESC);
