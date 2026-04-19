CREATE TABLE `subcontractor_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`subcontractorId` int NOT NULL,
	`clientId` int NOT NULL,
	`assignment_status` enum('assigned','accepted','declined','completed') NOT NULL DEFAULT 'assigned',
	`magicToken` varchar(64),
	`inviteSentAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subcontractor_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `subcontractor_assignments_magicToken_unique` UNIQUE(`magicToken`)
);
--> statement-breakpoint
CREATE TABLE `subcontractor_timesheets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`jobId` int NOT NULL,
	`subcontractorId` int NOT NULL,
	`clientId` int NOT NULL,
	`workDate` timestamp NOT NULL,
	`hours` decimal(6,2) NOT NULL,
	`description` text,
	`rateCents` int NOT NULL,
	`totalCents` int NOT NULL,
	`costItemId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subcontractor_timesheets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subcontractors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`trade` varchar(255),
	`abn` varchar(20),
	`email` varchar(320),
	`phone` varchar(50),
	`hourlyRateCents` int,
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subcontractors_id` PRIMARY KEY(`id`)
);
