CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referralProgrammeEnabled` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
