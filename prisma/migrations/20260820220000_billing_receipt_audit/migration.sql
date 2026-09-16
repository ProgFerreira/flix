-- AlterTable
ALTER TABLE `Subscription` ADD COLUMN `lastReminderType` ENUM('upcoming', 'overdue') NULL,
    ADD COLUMN `lastReminderAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `PlanPayment` ADD COLUMN `receiptPath` VARCHAR(191) NULL,
    ADD COLUMN `receiptMimeType` VARCHAR(191) NULL,
    ADD COLUMN `receiptSize` INTEGER NULL;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adminId` INTEGER NULL,
    `action` VARCHAR(64) NOT NULL,
    `targetType` VARCHAR(32) NOT NULL,
    `targetId` INTEGER NULL,
    `meta` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    INDEX `AdminAuditLog_adminId_createdAt_idx`(`adminId`, `createdAt`),
    INDEX `AdminAuditLog_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
