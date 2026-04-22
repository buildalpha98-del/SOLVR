ALTER TABLE `client_profiles` MODIFY COLUMN `logoUrl` text;--> statement-breakpoint
ALTER TABLE `client_profiles` MODIFY COLUMN `googleReviewLink` text;--> statement-breakpoint
ALTER TABLE `crm_clients` MODIFY COLUMN `quoteBrandLogoUrl` text;--> statement-breakpoint
ALTER TABLE `form_submissions` MODIFY COLUMN `pdfUrl` text;--> statement-breakpoint
ALTER TABLE `job_photos` MODIFY COLUMN `imageUrl` text NOT NULL;--> statement-breakpoint
ALTER TABLE `job_photos` MODIFY COLUMN `imageKey` text NOT NULL;--> statement-breakpoint
ALTER TABLE `portal_jobs` MODIFY COLUMN `invoicePdfUrl` text;--> statement-breakpoint
ALTER TABLE `portal_jobs` MODIFY COLUMN `completionReportUrl` text;--> statement-breakpoint
ALTER TABLE `purchase_orders` MODIFY COLUMN `pdfUrl` text;--> statement-breakpoint
ALTER TABLE `quote_photos` MODIFY COLUMN `imageUrl` text NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_photos` MODIFY COLUMN `thumbnailUrl` text;--> statement-breakpoint
ALTER TABLE `quote_voice_recordings` MODIFY COLUMN `audioUrl` text NOT NULL;--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `pdfUrl` text;--> statement-breakpoint
ALTER TABLE `quotes` MODIFY COLUMN `pdfKey` text;