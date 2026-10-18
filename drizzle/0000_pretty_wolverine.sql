CREATE TABLE `daily_forecasts` (
	`place_id` integer NOT NULL,
	`date` text NOT NULL,
	`fetched_at` text NOT NULL,
	`temp_max_c` real,
	`temp_min_c` real,
	`snowfall_cm` real,
	`snow_depth_max_cm` real,
	`precipitation_mm` real,
	`precipitation_probability_pct` integer,
	`weather_code` integer,
	`sunshine_s` real,
	`daylight_s` real,
	`wind_max_kmh` real,
	`uv_index_max` real,
	`marine_fetched_at` text,
	`wave_height_max_m` real,
	`wave_period_max_s` real,
	PRIMARY KEY(`place_id`, `date`),
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `place_lookups` (
	`query` text NOT NULL,
	`country_code` text NOT NULL,
	`place_id` integer NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`query`, `country_code`),
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `places` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`admin1` text,
	`country` text NOT NULL,
	`country_code` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`elevation` real NOT NULL,
	`timezone` text NOT NULL,
	`population` integer,
	`fetched_at` text NOT NULL
);
