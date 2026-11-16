import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cumulativeUsage = sqliteTable("cumulative_usage", {
  email: text("email").primaryKey(),
  totalTokens: integer("total_tokens").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const cumulativeUsageEvents = sqliteTable("cumulative_usage_events", {
  eventId: text("event_id").primaryKey(),
  email: text("email"),
  createdAt: text("created_at").notNull(),
});
