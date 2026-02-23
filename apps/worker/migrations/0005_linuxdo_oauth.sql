-- Add Linux DO OAuth support
ALTER TABLE users ADD COLUMN linuxdo_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_linuxdo_id ON users(linuxdo_id);
