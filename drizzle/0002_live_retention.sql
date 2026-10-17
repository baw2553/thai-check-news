ALTER TABLE news_articles ADD COLUMN first_seen_at text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE news_articles ADD COLUMN material_updated_at text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE news_articles ADD COLUMN fingerprint text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE INDEX idx_news_articles_material_updated_at ON news_articles (material_updated_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS refresh_state (name text PRIMARY KEY NOT NULL, checked_at text NOT NULL DEFAULT '');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS daily_snapshots (kind text PRIMARY KEY NOT NULL, cycle text NOT NULL, payload text NOT NULL, checked_at text NOT NULL);
--> statement-breakpoint
PRAGMA optimize;
