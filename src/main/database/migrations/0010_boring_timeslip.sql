CREATE TABLE `managed_package_update_recoveries` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`owner_token` text NOT NULL,
	`package_name` text NOT NULL,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `managed_package_update_recoveries_package_name_unique` ON `managed_package_update_recoveries` (`package_name`);