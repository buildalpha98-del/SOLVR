CREATE TABLE `google_review_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int,
	`customerName` varchar(255),
	`customerPhone` varchar(50),
	`customerEmail` varchar(320),
	`review_channel` enum('sms','email','both') NOT NULL DEFAULT 'both',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`review_status` enum('sent','failed','skipped') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `google_review_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `googleReviewLink` varchar(512);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `reviewRequestEnabled` boolean DEFAULT true NOT NULL;