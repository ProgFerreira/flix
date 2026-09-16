-- AlterTable
ALTER TABLE `Collection` ADD COLUMN `isPublic` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shareToken` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Collection_shareToken_key` ON `Collection`(`shareToken`);
