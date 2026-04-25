CREATE TABLE `sms_conversations` (
	`id` varchar(36) NOT NULL,
	`clientId` int NOT NULL,
	`customerPhone` varchar(50) NOT NULL,
	`customerName` varchar(255),
	`tradieCustomerId` int,
	`lastMessagePreview` varchar(280),
	`lastDirection` enum('inbound','outbound'),
	`lastMessageAt` timestamp,
	`unreadCount` int NOT NULL DEFAULT 0,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_messages` (
	`id` varchar(36) NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`clientId` int NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`body` text NOT NULL,
	`twilioSid` varchar(64),
	`status` enum('queued','sent','delivered','failed','received') NOT NULL DEFAULT 'received',
	`sentBy` enum('tradie','auto-faq','campaign','system'),
	`aiSuggestedReply` text,
	`readAt` timestamp,
	`sentAt` timestamp,
	`relatedJobId` int,
	`relatedQuoteId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sms_messages_id` PRIMARY KEY(`id`)
);
