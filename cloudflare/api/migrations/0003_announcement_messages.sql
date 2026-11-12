CREATE TABLE announcement_messages (
  id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  rate_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_announcement_messages_seller ON announcement_messages(seller_id, created_at);
CREATE INDEX idx_announcement_messages_rate ON announcement_messages(rate_key, created_at);
CREATE INDEX idx_announcement_messages_email ON announcement_messages(email, created_at);