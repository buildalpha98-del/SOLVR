CREATE TABLE `client_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`refereeId` int NOT NULL,
	`status` enum('pending','converted','rewarded') NOT NULL DEFAULT 'pending',
	`convertedAt` timestamp,
	`rewardedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `referralCode` varchar(32);--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `referredByClientId` int;--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `pendingDiscountPct` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `crm_clients` ADD CONSTRAINT `crm_clients_referralCode_unique` UNIQUE(`referralCode`);