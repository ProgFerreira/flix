-- AlterTable
ALTER TABLE `Video` ADD COLUMN `previewPath` VARCHAR(191) NULL,
    ADD COLUMN `playbackPath` VARCHAR(191) NULL,
    ADD COLUMN `thumbPath` VARCHAR(191) NULL,
    ADD COLUMN `processingStartedAt` DATETIME(3) NULL,
    ADD COLUMN `processError` VARCHAR(500) NULL;

-- CreateIndex
CREATE INDEX `Video_status_processingStartedAt_idx` ON `Video`(`status`, `processingStartedAt`);
