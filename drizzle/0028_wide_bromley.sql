ALTER TABLE `client_profiles` ADD `licenceNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `licenceAuthority` varchar(255);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `licenceExpiryDate` varchar(20);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `insurerName` varchar(255);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `insurancePolicyNumber` varchar(100);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `insuranceExpiryDate` varchar(20);--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `insuranceCoverageAud` int;