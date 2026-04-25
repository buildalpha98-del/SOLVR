CREATE TABLE `stripe_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`stripeAccountId` varchar(64) NOT NULL,
	`chargesEnabled` boolean NOT NULL DEFAULT false,
	`payoutsEnabled` boolean NOT NULL DEFAULT false,
	`detailsSubmitted` boolean NOT NULL DEFAULT false,
	`country` varchar(2) NOT NULL DEFAULT 'AU',
	`defaultCurrency` varchar(3) NOT NULL DEFAULT 'aud',
	`currentlyDueRequirements` json,
	`onboardingCompletedAt` timestamp,
	`disconnectedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_connections_clientId_unique` UNIQUE(`clientId`)
);
