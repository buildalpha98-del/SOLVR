CREATE TABLE `compliance_documents` (
	`id` varchar(36) NOT NULL,
	`clientId` int NOT NULL,
	`jobId` int,
	`docType` enum('swms','safety_cert','site_induction','jsa') NOT NULL,
	`title` varchar(255) NOT NULL,
	`jobDescription` text,
	`pdfUrl` text,
	`content` text,
	`status_comp` enum('generating','ready','error') NOT NULL DEFAULT 'generating',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_documents_id` PRIMARY KEY(`id`)
);
