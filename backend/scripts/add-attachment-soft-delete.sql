-- Add soft-delete columns to attachment table (for organisation logo/header/footer).
-- Run this once if your attachment table does not have deleted_by and deleted_date.
-- When organisation logo/header/footer is replaced, the old attachment is soft-deleted
-- so the app always uses the current image.

ALTER TABLE attachment ADD COLUMN deleted_by INT NULL;
ALTER TABLE attachment ADD COLUMN deleted_date DATETIME NULL;
