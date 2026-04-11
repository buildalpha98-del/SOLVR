CREATE TABLE `job_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int NOT NULL,
	`staffId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp NOT NULL,
	`sched_status` enum('pending','confirmed','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
	`notes` text,
	`notificationSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staff_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`mobile` varchar(20),
	`trade` varchar(100),
	`licenceNumber` varchar(100),
	`hourlyRate` decimal(10,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int NOT NULL,
	`staffId` int NOT NULL,
	`scheduleId` int,
	`checkInAt` timestamp NOT NULL,
	`checkOutAt` timestamp,
	`checkInLat` decimal(10,7),
	`checkInLng` decimal(10,7),
	`checkOutLat` decimal(10,7),
	`checkOutLng` decimal(10,7),
	`durationMinutes` int,
	`convertedToJobCost` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
