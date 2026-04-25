CREATE TABLE `xero_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`tenantId` varchar(36) NOT NULL,
	`tenantName` varchar(255) NOT NULL,
	`refreshTokenEncrypted` text NOT NULL,
	`accessTokenEncrypted` text NOT NULL,
	`accessTokenExpiresAt` timestamp NOT NULL,
	`webhookSigningKeyEncrypted` text,
	`disconnectedAt` timestamp,
	`xeroInvoiceStatus` enum('DRAFT','AUTHORISED') NOT NULL DEFAULT 'DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `xero_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `xero_connections_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `xero_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`invoiceChaseId` varchar(36),
	`xeroEvent` enum('push_invoice','pull_status','webhook_received','token_refresh','connect','disconnect') NOT NULL,
	`xeroOutcome` enum('ok','error') NOT NULL,
	`detail` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `xero_sync_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoice_chases` ADD `xeroInvoiceId` varchar(36);--> statement-breakpoint
ALTER TABLE `invoice_chases` ADD `xeroSyncedAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoice_chases` ADD `xeroSyncFailedAt` timestamp;--> statement-breakpoint
ALTER TABLE `invoice_chases` ADD `xeroSyncError` varchar(500);