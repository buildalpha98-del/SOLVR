CREATE TABLE `account_deletion_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`businessName` varchar(255),
	`contactEmail` varchar(255),
	`deletedBy` varchar(100) NOT NULL,
	`reason` varchar(500),
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_deletion_logs_id` PRIMARY KEY(`id`)
);
