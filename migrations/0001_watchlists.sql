PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_watchlists_owner_key
ON watchlists(owner_key);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL,
  external_position_id TEXT,
  wallet_address TEXT,
  protocol TEXT NOT NULL,
  chain TEXT NOT NULL,
  asset TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_positions_watchlist_id
ON positions(watchlist_id);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  alert_state TEXT NOT NULL,
  verification_required INTEGER NOT NULL DEFAULT 0,
  health_factor REAL,
  market_decision TEXT,
  security_state TEXT,
  payload_json TEXT NOT NULL,
  evaluation_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_position_observed
ON snapshots(position_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  snapshot_id TEXT NOT NULL,
  previous_state TEXT,
  current_state TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity_rank INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_events_position_created
ON alert_events(position_id, created_at DESC);
