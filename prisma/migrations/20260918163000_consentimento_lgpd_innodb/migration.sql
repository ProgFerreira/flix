-- WAMP/MyISAM default skipped the original FK from 20260916090000_lgpd_soft_delete.
-- InnoDB is required for the User cascade declared in schema.prisma.
ALTER TABLE `ConsentimentoLgpd` ENGINE=InnoDB;

-- Rows left behind when users were hard-deleted before the FK existed.
DELETE `c` FROM `ConsentimentoLgpd` `c`
LEFT JOIN `User` `u` ON `u`.`id` = `c`.`userId`
WHERE `u`.`id` IS NULL;

SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ConsentimentoLgpd'
    AND CONSTRAINT_NAME = 'ConsentimentoLgpd_userId_fkey'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE `ConsentimentoLgpd` ADD CONSTRAINT `ConsentimentoLgpd_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
