ALTER TABLE `Video` MODIFY `source` ENUM('youtube', 'upload', 'article') NOT NULL DEFAULT 'youtube';
