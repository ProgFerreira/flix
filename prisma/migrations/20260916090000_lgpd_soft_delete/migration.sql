-- AlterTable
ALTER TABLE `User` ADD COLUMN `deletadoEm` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `User_deletadoEm_idx` ON `User`(`deletadoEm`);

-- CreateTable
CREATE TABLE `ConsentimentoLgpd` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `aceito` BOOLEAN NOT NULL,
    `versao` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ConsentimentoLgpd_userId_tipo_idx`(`userId`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ConsentimentoLgpd` ADD CONSTRAINT `ConsentimentoLgpd_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: pagamentos não somem se o usuário for apagado por engano
ALTER TABLE `PlanPayment` DROP FOREIGN KEY `PlanPayment_userId_fkey`;
ALTER TABLE `PlanPayment` ADD CONSTRAINT `PlanPayment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
