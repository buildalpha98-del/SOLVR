CREATE TABLE `job_photos` (
	`id` varchar(36) NOT NULL,
	`jobId` int NOT NULL,
	`clientId` int NOT NULL,
	`photoType` enum('before','after','during','other') NOT NULL,
	`imageUrl` varchar(512) NOT NULL,
	`imageKey` varchar(512) NOT NULL,
	`caption` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_progress_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`clientId` int NOT NULL,
	`amountCents` int NOT NULL,
	`method` enum('bank_transfer','cash','stripe','cheque','other') NOT NULL,
	`label` varchar(255),
	`note` text,
	`receivedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_progress_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tradie_customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`address` varchar(512),
	`suburb` varchar(100),
	`state` varchar(50),
	`postcode` varchar(10),
	`jobCount` int NOT NULL DEFAULT 1,
	`totalSpentCents` int NOT NULL DEFAULT 0,
	`firstJobAt` timestamp,
	`lastJobAt` timestamp,
	`lastJobType` varchar(255),
	`notes` text,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tradie_customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `customerName` varchar(255);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `customerEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `customerPhone` varchar(50);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `customerAddress` varchar(512);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `invoiceNumber` varchar(32);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `invoiceStatus` enum('not_invoiced','draft','sent','paid','overdue') DEFAULT 'not_invoiced';--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `invoicedAmount` int;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `amountPaid` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `paymentMethod` enum('bank_transfer','cash','stripe','other');--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `invoicedAt` timestamp;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `paidAt` timestamp;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `invoicePdfUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `completionNotes` text;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `variationNotes` text;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `actualHours` decimal(6,2);