CREATE TABLE `cumulative_usage` (
	`email` text PRIMARY KEY NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
