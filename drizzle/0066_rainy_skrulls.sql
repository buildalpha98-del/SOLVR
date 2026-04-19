CREATE TABLE `job_type_form_requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`jobType` varchar(255) NOT NULL,
	`requiredFormTemplateIds` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_type_form_requirements_id` PRIMARY KEY(`id`)
);
