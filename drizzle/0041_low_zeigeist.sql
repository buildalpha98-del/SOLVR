CREATE TABLE `job_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`clientId` int NOT NULL,
	`positive` boolean NOT NULL,
	`comment` text,
	`customerName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_feedback_jobId_unique` UNIQUE(`jobId`)
);
