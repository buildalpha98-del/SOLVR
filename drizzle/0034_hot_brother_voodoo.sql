CREATE TABLE `staff_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`clientId` int NOT NULL,
	`token` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_sessions_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `staff_members` ADD `staffPin` varchar(72);