ALTER TABLE `google_review_requests` MODIFY COLUMN `review_status` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'sent';--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `reviewRequestDelayMinutes` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `google_review_requests` ADD `scheduledSendAt` timestamp;