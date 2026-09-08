CREATE TABLE `managed_package_removal_recoveries` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`owner_token` text NOT NULL,
	`package_name` text NOT NULL,
	`snapshot` text NOT NULL
);
