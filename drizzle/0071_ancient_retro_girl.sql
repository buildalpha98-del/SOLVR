CREATE TABLE `ai_task_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int NOT NULL,
	`event` enum('suggest','accept') NOT NULL,
	`staffSummary` varchar(500) NOT NULL,
	`model` varchar(100),
	`detail` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_task_audit_id` PRIMARY KEY(`id`)
);
