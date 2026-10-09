ALTER TABLE positions ADD COLUMN last_checked_at TEXT;
ALTER TABLE positions ADD COLUMN last_error TEXT;

CREATE TABLE IF NOT EXISTS delivery_destinations (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_delivery_destinations_watchlist
ON delivery_destinations(watchlist_id, enabled);

CREATE TABLE IF NOT EXISTS monitor_runs (
  id TEXT PRIMARY KEY,
  scheduled_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  positions_total INTEGER NOT NULL DEFAULT 0,
  positions_checked INTEGER NOT NULL DEFAULT 0,
  events_created INTEGER NOT NULL DEFAULT 0,
  deliveries_attempted INTEGER NOT NULL DEFAULT 0,
  deliveries_succeeded INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_monitor_runs_started
ON monitor_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  error TEXT,
  attempted_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES alert_events(id) ON DELETE CASCADE,
  FOREIGN KEY (destination_id) REFERENCES delivery_destinations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deliveries_event
ON deliveries(event_id, attempted_at DESC);
