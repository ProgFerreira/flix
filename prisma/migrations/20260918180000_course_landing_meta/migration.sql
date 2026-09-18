-- AlterTable
ALTER TABLE `Course`
  ADD COLUMN `instructorName` VARCHAR(120) NULL,
  ADD COLUMN `level` ENUM('beginner', 'intermediate', 'advanced') NULL,
  ADD COLUMN `requirements` TEXT NULL,
  ADD COLUMN `audience` TEXT NULL,
  ADD COLUMN `faq` TEXT NULL,
  ADD COLUMN `trailerVideoId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Course_trailerVideoId_idx` ON `Course`(`trailerVideoId`);

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_trailerVideoId_fkey` FOREIGN KEY (`trailerVideoId`) REFERENCES `Video`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `CourseFavorite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CourseFavorite_userId_courseId_key`(`userId`, `courseId`),
    INDEX `CourseFavorite_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

-- CreateTable
CREATE TABLE `CourseReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CourseReview_userId_courseId_key`(`userId`, `courseId`),
    INDEX `CourseReview_courseId_createdAt_idx`(`courseId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

-- AddForeignKey
ALTER TABLE `CourseFavorite` ADD CONSTRAINT `CourseFavorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseFavorite` ADD CONSTRAINT `CourseFavorite_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseReview` ADD CONSTRAINT `CourseReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseReview` ADD CONSTRAINT `CourseReview_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
