CREATE TABLE `referral_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`stripeSessionId` varchar(255),
	`subscriberEmail` varchar(320) NOT NULL,
	`subscriberName` varchar(255),
	`plan` enum('starter','professional') NOT NULL,
	`monthlyAmountCents` int NOT NULL,
	`commissionAmountCents` int NOT NULL,
	`status` enum('active','cancelled','pending') NOT NULL DEFAULT 'active',
	`lastPaidMonth` varchar(7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referral_conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`refCode` varchar(32) NOT NULL,
	`commissionPct` int NOT NULL DEFAULT 20,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referral_partners_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_partners_refCode_unique` UNIQUE(`refCode`)
);
