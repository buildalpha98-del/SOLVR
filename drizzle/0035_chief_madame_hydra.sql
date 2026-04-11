ALTER TABLE `job_schedule` ADD `staffConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `job_schedule` ADD `staffDeclinedAt` timestamp;--> statement-breakpoint
ALTER TABLE `staff_members` ADD `pushSubscription` text;