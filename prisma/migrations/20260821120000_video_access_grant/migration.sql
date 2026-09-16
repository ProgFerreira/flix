-- CreateTable
CREATE TABLE `VideoAccessGrant` (
    `videoId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `grantedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VideoAccessGrant_userId_idx`(`userId`),
    PRIMARY KEY (`videoId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VideoAccessGrant` ADD CONSTRAINT `VideoAccessGrant_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `Video`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoAccessGrant` ADD CONSTRAINT `VideoAccessGrant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoAccessGrant` ADD CONSTRAINT `VideoAccessGrant_grantedBy_fkey` FOREIGN KEY (`grantedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
