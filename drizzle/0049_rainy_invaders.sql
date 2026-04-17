ALTER TABLE `tradie_customers` ADD `optedOutSms` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tradie_customers` ADD `smsUnsubscribeToken` varchar(64);