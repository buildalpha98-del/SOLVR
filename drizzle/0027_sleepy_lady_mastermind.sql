CREATE TABLE `job_cost_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`clientId` int NOT NULL,
	`category` enum('materials','labour','subcontractor','equipment','other') NOT NULL,
	`description` varchar(500) NOT NULL,
	`amountCents` int NOT NULL,
	`supplier` varchar(255),
	`reference` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_cost_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_links` (
	`id` varchar(36) NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`amountCents` int NOT NULL,
	`customerName` varchar(255),
	`customerPhone` varchar(50),
	`customerEmail` varchar(320),
	`invoiceNumber` varchar(32),
	`status` enum('pending','paid','expired','cancelled') NOT NULL DEFAULT 'pending',
	`stripePaymentIntentId` varchar(255),
	`smsSentAt` timestamp,
	`paidAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_links_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `quote_follow_ups` (
	`id` varchar(36) NOT NULL,
	`clientId` int NOT NULL,
	`quoteId` varchar(36) NOT NULL,
	`followUpCount` int NOT NULL DEFAULT 0,
	`lastFollowUpAt` timestamp,
	`nextFollowUpAt` timestamp,
	`status` enum('active','stopped','converted','expired') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_follow_ups_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_follow_ups_quoteId_unique` UNIQUE(`quoteId`)
);
