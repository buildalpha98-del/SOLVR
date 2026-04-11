ALTER TABLE `client_profiles` ADD `notifyEmailNewCall` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyPushNewCall` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyEmailNewQuote` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyPushNewQuote` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyEmailQuoteAccepted` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyPushQuoteAccepted` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyEmailJobUpdate` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyPushJobUpdate` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `client_profiles` ADD `notifyEmailWeeklySummary` boolean DEFAULT true NOT NULL;