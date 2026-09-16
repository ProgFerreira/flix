-- The shared rate limiter requires transaction row locks, unavailable on MyISAM.
ALTER TABLE `RateLimitBucket` ENGINE=InnoDB;
