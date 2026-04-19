CREATE TABLE `form_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`templateId` int NOT NULL,
	`jobId` int,
	`title` varchar(255) NOT NULL,
	`formValues` json NOT NULL,
	`signatures` json,
	`pdfUrl` varchar(512),
	`form_status` enum('draft','completed','archived') NOT NULL DEFAULT 'draft',
	`submittedBy` varchar(255),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int,
	`name` varchar(255) NOT NULL,
	`form_category` enum('certificate','safety','inspection','custom') NOT NULL DEFAULT 'custom',
	`description` text,
	`fields` json NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_templates_id` PRIMARY KEY(`id`)
);
