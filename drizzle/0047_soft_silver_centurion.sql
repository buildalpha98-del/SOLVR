CREATE TABLE `portal_team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`portal_team_role` enum('admin','viewer') NOT NULL DEFAULT 'viewer',
	`passwordHash` varchar(255),
	`inviteToken` varchar(128),
	`inviteExpiresAt` timestamp,
	`sessionToken` varchar(128),
	`sessionExpiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_team_members_inviteToken_unique` UNIQUE(`inviteToken`),
	CONSTRAINT `portal_team_members_sessionToken_unique` UNIQUE(`sessionToken`)
);
