CREATE TABLE `price_list_markup_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`category` varchar(50) NOT NULL,
	`markupPct` decimal(5,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_list_markup_settings_id` PRIMARY KEY(`id`)
);
