ALTER TABLE `crm_clients` ADD `quoteAbn` varchar(50);--> statement-breakpoint
ALTER TABLE `crm_clients` ADD `quoteDefaultNotes` text;--> statement-breakpoint
ALTER TABLE `quotes` ADD `pdfUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `quotes` ADD `pdfKey` varchar(512);