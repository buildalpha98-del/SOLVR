ALTER TABLE `crm_clients` ADD `portalPasswordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `portal_sessions` ADD `passwordResetToken` varchar(128);--> statement-breakpoint
ALTER TABLE `portal_sessions` ADD `passwordResetExpiresAt` timestamp;