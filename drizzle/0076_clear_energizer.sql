CREATE TABLE `stripe_disputes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`stripeDisputeId` varchar(64) NOT NULL,
	`stripeChargeId` varchar(64) NOT NULL,
	`paymentLinkId` varchar(36),
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'aud',
	`reason` varchar(64) NOT NULL,
	`status` varchar(64) NOT NULL,
	`evidenceDueBy` timestamp,
	`stripeCreatedAt` timestamp NOT NULL,
	`lastWebhookAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_disputes_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_disputes_stripeDisputeId_unique` UNIQUE(`stripeDisputeId`)
);
--> statement-breakpoint
ALTER TABLE `payment_links` ADD `refundedAmountCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_links` ADD `refundedAt` timestamp;--> statement-breakpoint
ALTER TABLE `payment_links` ADD `refundReason` varchar(255);