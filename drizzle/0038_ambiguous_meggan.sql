CREATE TABLE `staff_availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`staffId` int NOT NULL,
	`unavailableDate` varchar(10) NOT NULL,
	`reason` varchar(50),
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_availability_id` PRIMARY KEY(`id`)
);
