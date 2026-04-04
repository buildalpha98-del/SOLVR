CREATE TABLE `portal_calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`location` varchar(255),
	`contactName` varchar(255),
	`contactPhone` varchar(50),
	`startAt` timestamp NOT NULL,
	`endAt` timestamp,
	`isAllDay` boolean NOT NULL DEFAULT false,
	`color` varchar(32) NOT NULL DEFAULT 'amber',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portal_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`interactionId` int,
	`callerName` varchar(255),
	`callerPhone` varchar(50),
	`jobType` varchar(255) NOT NULL,
	`description` text,
	`location` varchar(255),
	`stage` enum('new_lead','quoted','booked','completed','lost') NOT NULL DEFAULT 'new_lead',
	`estimatedValue` int,
	`actualValue` int,
	`preferredDate` varchar(255),
	`notes` text,
	`hasCalendarEvent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portal_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`accessToken` varchar(128) NOT NULL,
	`sessionToken` varchar(128),
	`sessionExpiresAt` timestamp,
	`lastAccessedAt` timestamp,
	`isRevoked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portal_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_sessions_accessToken_unique` UNIQUE(`accessToken`)
);
