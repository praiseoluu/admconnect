-- 001_create_lgas.sql
CREATE TABLE IF NOT EXISTS `lgas` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(100) NOT NULL,
    `state`      VARCHAR(100) NOT NULL DEFAULT 'Lagos',
    `is_capital` BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_lga_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
