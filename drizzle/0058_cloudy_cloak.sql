ALTER TABLE `voice_agent_subscriptions` ADD `subscriptionSource` enum('stripe','apple','manual') DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE `voice_agent_subscriptions` ADD `revenueCatId` varchar(128);--> statement-breakpoint
ALTER TABLE `voice_agent_subscriptions` ADD `appleOriginalTransactionId` varchar(128);