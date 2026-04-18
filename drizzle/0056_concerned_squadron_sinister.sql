CREATE TABLE `job_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`clientId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`task_status` enum('pending','in_progress','done','skipped') NOT NULL DEFAULT 'pending',
	`dueDate` varchar(10),
	`assignedStaffId` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`notes` text,
	`aiGenerated` boolean NOT NULL DEFAULT false,
	`requiresDoc` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portal_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`conversationId` varchar(36) NOT NULL,
	`chat_role` enum('user','assistant','tool') NOT NULL,
	`content` text NOT NULL,
	`toolCallData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portal_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `nextActionSuggestion` text;--> statement-breakpoint
ALTER TABLE `portal_jobs` ADD `tasksGeneratedAt` timestamp;