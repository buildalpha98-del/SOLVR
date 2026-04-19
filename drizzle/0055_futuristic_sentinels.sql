ALTER TABLE `tradie_customers` ADD `optedOutEmail` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tradie_customers` ADD `emailUnsubscribeToken` varchar(64);