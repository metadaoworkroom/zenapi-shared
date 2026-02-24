CREATE TABLE IF NOT EXISTS user_checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  reward REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS user_checkins_user_date ON user_checkins(user_id, checkin_date);
