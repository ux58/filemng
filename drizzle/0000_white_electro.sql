CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_prefix` text NOT NULL,
	`key_hash` text NOT NULL,
	`scopes` text NOT NULL,
	`rate_limit` integer DEFAULT 60 NOT NULL,
	`last_used_at` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_hash` text NOT NULL,
	`ua` text,
	`ip` text,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_refresh_hash_unique` ON `sessions` (`refresh_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`artist` text,
	`album` text,
	`genre` text,
	`year` integer,
	`duration_sec` integer,
	`track_no` integer,
	`description` text,
	`lyrics` text,
	`audio_key` text,
	`audio_name` text,
	`audio_mime` text,
	`audio_size` integer,
	`cover_key` text,
	`cover_name` text,
	`cover_mime` text,
	`cover_size` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_songs_created` ON `songs` (`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);