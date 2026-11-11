-- Explicitly public per-announcement contacts; never backfill private account data.
ALTER TABLE announcements ADD COLUMN contact_phone TEXT;
ALTER TABLE announcements ADD COLUMN contact_email TEXT;