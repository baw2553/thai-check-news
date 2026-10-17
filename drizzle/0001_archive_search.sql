ALTER TABLE news_articles ADD COLUMN normalized_title text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE news_articles ADD COLUMN content_json text;
--> statement-breakpoint
CREATE INDEX idx_news_articles_normalized_title ON news_articles (normalized_title);
--> statement-breakpoint
PRAGMA optimize;
