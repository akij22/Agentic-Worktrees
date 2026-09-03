CREATE TABLE `managed_package_installations` (
	`package_name` text PRIMARY KEY NOT NULL,
	`item_kind` text NOT NULL,
	`item_id` text NOT NULL,
	`requested_spec` text NOT NULL,
	`active_version` text,
	`active_integrity` text,
	`active_content_digest` text,
	`trust` text NOT NULL,
	`review_status` text NOT NULL,
	`accepted_permission_digest` text,
	`state` text NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "managed_package_installations_active_metadata_check" CHECK("managed_package_installations"."state" = 'migration_pending' OR ("managed_package_installations"."active_version" IS NOT NULL AND "managed_package_installations"."active_integrity" IS NOT NULL AND "managed_package_installations"."active_content_digest" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `managed_package_installations_item_unique` ON `managed_package_installations` (`item_kind`,`item_id`);--> statement-breakpoint
CREATE TABLE `managed_package_operations` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`package_name` text,
	`requested_spec` text NOT NULL,
	`candidate_version` text,
	`candidate_integrity` text,
	`candidate_content_digest` text,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `managed_package_operations_status_idx` ON `managed_package_operations` (`status`);--> statement-breakpoint
CREATE INDEX `managed_package_operations_stage_idx` ON `managed_package_operations` (`stage`);