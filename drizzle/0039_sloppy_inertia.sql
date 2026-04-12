ALTER TABLE `portal_jobs` ADD `isRecurring` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `recurrenceFrequency` enum('weekly','fortnightly','monthly');--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `parentJobId` int;