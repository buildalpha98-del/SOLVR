CREATE TABLE `voice_agent_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` text,
	`plan` enum('starter','professional') NOT NULL,
	`billingCycle` enum('monthly','annual') NOT NULL DEFAULT 'monthly',
	`stripeCustomerId` varchar(64),
	`stripeSubscriptionId` varchar(64),
	`stripeSessionId` varchar(128),
	`status` enum('trialing','active','cancelled','past_due','incomplete') NOT NULL DEFAULT 'trialing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voice_agent_subscriptions_id` PRIMARY KEY(`id`)
);
