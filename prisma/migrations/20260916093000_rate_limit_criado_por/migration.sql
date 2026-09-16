-- AlterTable
ALTER TABLE `User` ADD COLUMN `criadoPorId` INTEGER NULL;

-- AlterTable
ALTER TABLE `PlanPayment` ADD COLUMN `criadoPorId` INTEGER NULL;

-- CreateTable
CREATE TABLE `RateLimitBucket` (
    `chave` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL,
    `resetAt` DATETIME(3) NOT NULL,

    INDEX `RateLimitBucket_resetAt_idx`(`resetAt`),
    PRIMARY KEY (`chave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_criadoPorId_idx` ON `User`(`criadoPorId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanPayment` ADD CONSTRAINT `PlanPayment_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
