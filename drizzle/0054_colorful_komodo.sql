ALTER TABLE `client_profiles` ADD `appointmentReminderEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `portal_calendar_events` ADD `reminderSentAt` timestamp;