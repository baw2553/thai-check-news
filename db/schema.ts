import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const newsArticles = sqliteTable("news_articles", {
  id: text("id").primaryKey(),
  eventKey: text("event_key").notNull(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  url: text("url").notNull(),
  publishedAt: text("published_at").notNull(),
  collectedAt: text("collected_at").notNull(),
  imageUrl: text("image_url"),
  sourceType: text("source_type").notNull().default("news"),
  entities: text("entities").notNull().default("[]"),
  eventTerms: text("event_terms").notNull().default("[]"),
  normalizedTitle: text("normalized_title").notNull().default(""),
  contentJson: text("content_json"),
  firstSeenAt: text("first_seen_at").notNull().default(""),
  materialUpdatedAt: text("material_updated_at").notNull().default(""),
  fingerprint: text("fingerprint").notNull().default(""),
});

export const refreshState = sqliteTable("refresh_state", {
  name: text("name").primaryKey(),
  checkedAt: text("checked_at").notNull().default(""),
});

export const dailySnapshots = sqliteTable("daily_snapshots", {
  kind: text("kind").primaryKey(),
  cycle: text("cycle").notNull(),
  payload: text("payload").notNull(),
  checkedAt: text("checked_at").notNull(),
});
