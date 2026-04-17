CREATE TABLE `price_list_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`unit` varchar(50) NOT NULL DEFAULT 'each',
	`price_list_category` enum('labour','materials','call_out','subcontractor','other') NOT NULL DEFAULT 'labour',
	`costCents` int,
	`sellCents` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_list_items_id` PRIMARY KEY(`id`)
);
