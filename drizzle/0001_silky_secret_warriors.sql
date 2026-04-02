CREATE TABLE `ai_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('client','deal','business','transcript') NOT NULL,
	`entityId` int,
	`insightType` enum('health-score','lead-score','daily-briefing','client-brief','follow-up','transcript-analysis','churn-risk') NOT NULL,
	`content` text NOT NULL,
	`score` int,
	`model` varchar(64),
	`inputTokens` int,
	`outputTokens` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_insights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_onboardings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`contactPhone` varchar(50),
	`businessName` varchar(255) NOT NULL,
	`tradeType` varchar(255) NOT NULL,
	`services` text NOT NULL,
	`serviceArea` varchar(255) NOT NULL,
	`hours` varchar(255) NOT NULL,
	`emergencyFee` varchar(255),
	`existingPhone` varchar(50),
	`jobManagementTool` varchar(255),
	`additionalNotes` text,
	`package` enum('setup-only','setup-monthly','full-managed') NOT NULL DEFAULT 'setup-monthly',
	`status` enum('intake-received','prompt-built','vapi-configured','call-forwarding-set','live','on-hold') NOT NULL DEFAULT 'intake-received',
	`savedPromptId` int,
	`crmClientId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_onboardings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`productType` enum('ai-receptionist','website','automation','training','seo','other') NOT NULL,
	`status` enum('not-started','in-progress','live','paused','cancelled') NOT NULL DEFAULT 'not-started',
	`config` text,
	`monthlyValue` int DEFAULT 0,
	`setupFee` int DEFAULT 0,
	`notes` text,
	`startedAt` timestamp,
	`liveAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`contactPhone` varchar(50),
	`businessName` varchar(255) NOT NULL,
	`tradeType` varchar(255),
	`serviceArea` varchar(255),
	`website` varchar(512),
	`stage` enum('lead','qualified','onboarding','active','churned','paused') NOT NULL DEFAULT 'lead',
	`package` enum('setup-only','setup-monthly','full-managed') DEFAULT 'setup-monthly',
	`mrr` int DEFAULT 0,
	`source` enum('demo','referral','outbound','inbound','other') DEFAULT 'demo',
	`summary` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`onboardingId` int,
	`leadId` int,
	`vapiAgentId` varchar(255),
	`savedPromptId` int,
	`healthScore` int,
	`aiBrief` text,
	`aiBriefUpdatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_interactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`type` enum('note','call','email','meeting','demo','onboarding','support','status-change','system') NOT NULL DEFAULT 'note',
	`title` varchar(512) NOT NULL,
	`body` text,
	`fromStage` varchar(64),
	`toStage` varchar(64),
	`isPinned` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crm_interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crm_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(32) NOT NULL DEFAULT 'amber',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crm_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `crm_tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prospectName` varchar(255) NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`industry` varchar(255),
	`stage` enum('lead','qualified','proposal','won','lost') NOT NULL DEFAULT 'lead',
	`estimatedValue` int DEFAULT 0,
	`packageInterest` enum('setup-only','setup-monthly','full-managed'),
	`source` enum('demo','referral','outbound','inbound','other') DEFAULT 'demo',
	`notes` text,
	`aiScore` int,
	`aiScoreReason` text,
	`aiNextAction` text,
	`aiScoredAt` timestamp,
	`crmClientId` int,
	`leadId` int,
	`expectedCloseAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipeline_deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(255) NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`ownerName` varchar(255) NOT NULL,
	`tradeType` varchar(255) NOT NULL,
	`services` text NOT NULL,
	`serviceArea` varchar(255) NOT NULL,
	`hours` varchar(255) NOT NULL,
	`emergencyFee` varchar(255),
	`jobManagementTool` varchar(255),
	`tone` varchar(64) NOT NULL,
	`additionalInstructions` text,
	`systemPrompt` text NOT NULL,
	`firstMessage` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_prompts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategy_call_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`businessName` varchar(255),
	`preferredTime` varchar(255),
	`demoPersona` varchar(255),
	`crmClientId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `strategy_call_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('todo','in-progress','done','cancelled') NOT NULL DEFAULT 'todo',
	`clientId` int,
	`dealId` int,
	`category` enum('follow-up','onboarding','support','sales','admin','other') NOT NULL DEFAULT 'other',
	`isAiGenerated` boolean NOT NULL DEFAULT false,
	`dueAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
