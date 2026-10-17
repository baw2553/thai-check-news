CREATE TABLE news_articles (
  id text PRIMARY KEY NOT NULL,
  event_key text NOT NULL,
  title text NOT NULL,
  source text NOT NULL,
  url text NOT NULL,
  published_at text NOT NULL,
  collected_at text NOT NULL,
  image_url text,
  source_type text DEFAULT 'news' NOT NULL,
  entities text DEFAULT '[]' NOT NULL,
  event_terms text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_news_articles_url ON news_articles (url);
--> statement-breakpoint
CREATE INDEX idx_news_articles_published_at ON news_articles (published_at);
--> statement-breakpoint
CREATE INDEX idx_news_articles_event_key ON news_articles (event_key);
--> statement-breakpoint
PRAGMA optimize;
