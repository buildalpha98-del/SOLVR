CREATE TABLE `call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`twilioCallSid` varchar(100) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`status` enum('ringing','in_progress','completed','missed','voicemail','no_answer','busy','failed') NOT NULL,
	`fromNumber` varchar(20) NOT NULL,
	`toNumber` varchar(20) NOT NULL,
	`customerPhone` varchar(20),
	`tradieCustomerId` int,
	`answeredBy` enum('human','ai_receptionist','voicemail'),
	`durationSeconds` int,
	`talkTimeSeconds` int,
	`recordingUrl` varchar(500),
	`recordingSid` varchar(100),
	`transcript` text,
	`aiSummary` text,
	`aiIntent` enum('new_quote','quote_followup','job_update','new_job','complaint','payment','general_enquiry','scheduling','other'),
	`aiActionItems` json,
	`aiSentiment` enum('positive','neutral','negative'),
	`linkedQuoteId` int,
	`linkedJobId` int,
	`calledAt` timestamp NOT NULL,
	`answeredAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `call_logs_twilioCallSid_unique` UNIQUE(`twilioCallSid`)
);
--> statement-breakpoint
CREATE TABLE `client_phone_numbers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`twilioSid` varchar(100) NOT NULL,
	`phoneNumber` varchar(20) NOT NULL,
	`friendlyNumber` varchar(20) NOT NULL,
	`type` enum('provisioned','ported','forwarded') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`isDefault` boolean NOT NULL DEFAULT true,
	`ringTimeoutSeconds` int NOT NULL DEFAULT 20,
	`aiFallbackEnabled` boolean NOT NULL DEFAULT true,
	`subscriptionStatus` enum('trial','active','past_due','unpaid','incomplete','cancelled') NOT NULL DEFAULT 'trial',
	`stripeSubscriptionId` varchar(100),
	`billingCycleStart` timestamp NOT NULL DEFAULT (now()),
	`inboundMinutesUsed` int NOT NULL DEFAULT 0,
	`outboundMinutesUsed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_phone_numbers_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_phone_numbers_phoneNumber_unique` UNIQUE(`phoneNumber`)
);
--> statement-breakpoint
CREATE TABLE `voip_push_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceId` varchar(100) NOT NULL,
	`platform` enum('ios','android') NOT NULL,
	`token` varchar(500) NOT NULL,
	`regularApnsToken` varchar(500),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voip_push_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `voip_push_tokens_userId_deviceId_unique` UNIQUE(`userId`,`deviceId`)
);
--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `tradieCustomerId` int;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `sourceCallLogId` int;--> statement-breakpoint
ALTER TABLE `quotes` ADD `tradieCustomerId` int;--> statement-breakpoint
ALTER TABLE `quotes` ADD `sourceCallLogId` int;--> statement-breakpoint
ALTER TABLE `tradie_customers` ADD CONSTRAINT `tradie_customers_clientId_phone_unique` UNIQUE(`clientId`,`phone`);--> statement-breakpoint
CREATE INDEX `call_logs_clientId_calledAt_idx` ON `call_logs` (`clientId`,`calledAt`);--> statement-breakpoint
CREATE INDEX `call_logs_clientId_tradieCustomerId_idx` ON `call_logs` (`clientId`,`tradieCustomerId`);--> statement-breakpoint
CREATE INDEX `client_phone_numbers_clientId_idx` ON `client_phone_numbers` (`clientId`);