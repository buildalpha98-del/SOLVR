CREATE TABLE `referral_blast_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sent` int NOT NULL DEFAULT 0,
	`failed` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`errors` text,
	`triggeredBy` varchar(255),
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_blast_logs_id` PRIMARY KEY(`id`)
);
