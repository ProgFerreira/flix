ALTER TABLE `User` MODIFY `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    MODIFY `plan` ENUM('free', 'premium', 'pro') NOT NULL DEFAULT 'free',
    MODIFY `status` ENUM('active', 'blocked') NOT NULL DEFAULT 'active';

ALTER TABLE `Subscription` MODIFY `plan` ENUM('free', 'premium', 'pro') NOT NULL,
    MODIFY `billing` ENUM('monthly', 'annual') NOT NULL,
    MODIFY `amount` DECIMAL(10, 2) NOT NULL,
    MODIFY `status` ENUM('active', 'overdue', 'cancelled', 'expired') NOT NULL DEFAULT 'active';

ALTER TABLE `PlanPayment` MODIFY `plan` ENUM('free', 'premium', 'pro') NOT NULL,
    MODIFY `billing` ENUM('monthly', 'annual') NOT NULL DEFAULT 'monthly',
    MODIFY `amount` DECIMAL(10, 2) NOT NULL,
    MODIFY `method` ENUM('pix', 'card', 'boleto', 'manual') NOT NULL DEFAULT 'manual',
    ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `PlanPayment_idempotencyKey_key` ON `PlanPayment`(`idempotencyKey`);
CREATE INDEX `PlanPayment_userId_createdAt_idx` ON `PlanPayment`(`userId`, `createdAt`);

ALTER TABLE `Video` MODIFY `source` ENUM('youtube', 'upload') NOT NULL DEFAULT 'youtube',
    MODIFY `fileSize` BIGINT NULL,
    MODIFY `status` ENUM('processing', 'ready', 'error') NOT NULL DEFAULT 'ready',
    MODIFY `requiredPlan` ENUM('free', 'premium', 'pro') NOT NULL DEFAULT 'free';

CREATE INDEX `Video_userId_createdAt_idx` ON `Video`(`userId`, `createdAt`);
CREATE INDEX `Video_userId_sortOrder_idx` ON `Video`(`userId`, `sortOrder`);
CREATE INDEX `Video_userId_videoId_idx` ON `Video`(`userId`, `videoId`);
CREATE INDEX `Video_source_published_status_idx` ON `Video`(`source`, `published`, `status`);

ALTER TABLE `VideoShare` MODIFY `permission` ENUM('view', 'edit') NOT NULL DEFAULT 'view';

ALTER TABLE `CollectionMember` MODIFY `role` ENUM('owner', 'editor', 'viewer') NOT NULL DEFAULT 'viewer';

CREATE INDEX `EmailVerificationToken_userId_expiresAt_idx` ON `EmailVerificationToken`(`userId`, `expiresAt`);
CREATE INDEX `PasswordResetToken_userId_expiresAt_idx` ON `PasswordResetToken`(`userId`, `expiresAt`);
CREATE INDEX `Subscription_status_nextBillingDate_idx` ON `Subscription`(`status`, `nextBillingDate`);
