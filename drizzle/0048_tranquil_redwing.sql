CREATE TABLE `sms_campaign_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`sms_recipient_status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`twilioSid` varchar(64),
	`errorMessage` varchar(512),
	`sentAt` timestamp,
	CONSTRAINT `sms_campaign_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`totalCount` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`sms_campaign_status` enum('pending','sending','completed','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `sms_campaigns_id` PRIMARY KEY(`id`)
);
