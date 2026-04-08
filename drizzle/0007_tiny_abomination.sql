CREATE TABLE `quote_line_items` (
	`id` varchar(36) NOT NULL,
	`quoteId` varchar(36) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`description` varchar(500) NOT NULL,
	`quantity` decimal(10,2) NOT NULL DEFAULT '1.00',
	`unit` varchar(20) DEFAULT 'each',
	`unitPrice` decimal(10,2),
	`lineTotal` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quote_line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_photos` (
	`id` varchar(36) NOT NULL,
	`quoteId` varchar(36) NOT NULL,
	`imageUrl` varchar(512) NOT NULL,
	`thumbnailUrl` varchar(512),
	`caption` varchar(255),
	`aiDescription` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quote_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_voice_recordings` (
	`id` varchar(36) NOT NULL,
	`clientId` int NOT NULL,
	`audioUrl` varchar(512) NOT NULL,
	`durationSeconds` int,
	`processingStatus` enum('pending','transcribing','extracting','complete','failed') NOT NULL DEFAULT 'pending',
	`transcript` text,
	`extractedJson` json,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quote_voice_recordings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` varchar(36) NOT NULL,
	`clientId` int NOT NULL,
	`quoteNumber` varchar(16) NOT NULL,
	`status` enum('draft','sent','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'draft',
	`customerName` varchar(255),
	`customerEmail` varchar(320),
	`customerPhone` varchar(50),
	`customerAddress` varchar(512),
	`jobTitle` varchar(255) NOT NULL,
	`jobDescription` text,
	`subtotal` decimal(10,2),
	`gstRate` decimal(5,2) NOT NULL DEFAULT '10.00',
	`gstAmount` decimal(10,2),
	`totalAmount` decimal(10,2),
	`paymentTerms` varchar(255),
	`validityDays` int NOT NULL DEFAULT 30,
	`validUntil` date,
	`notes` text,
	`customerToken` varchar(128) NOT NULL,
	`customerNote` text,
	`declineReason` varchar(50),
	`respondedAt` timestamp,
	`reportContent` json,
	`reportGeneratedAt` timestamp,
	`voiceRecordingId` varchar(36),
	`convertedJobId` int,
	`sentAt` timestamp,
	`issuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `quotes_customerToken_unique` UNIQUE(`customerToken`)
);
--> statement-breakpoint
ALTER TABLE `client_products` MODIFY COLUMN `productType` enum('ai-receptionist','website','automation','training','seo','quote-engine','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteBrandLogoUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteBrandPrimaryColor` varchar(16);--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteBrandSecondaryColor` varchar(16);--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteBrandFont` varchar(32);--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteGstRate` decimal(5,2) DEFAULT '10.00';--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quotePaymentTerms` varchar(255);--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteValidityDays` int DEFAULT 30;--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteReplyToEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `quotedAmount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `sourceQuoteId` varchar(36);