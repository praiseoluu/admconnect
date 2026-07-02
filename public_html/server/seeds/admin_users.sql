-- seeds/admin_users.sql
-- Admin and LGA staff accounts.
-- Replace PLACEHOLDER hashes with real bcrypt hashes before running.
--
-- Plaintext passwords:
--   admin1  → Oluwaseun Adeyemi
--   admin2  → Chidi Okafor
--   staff1  → Blessing Eze
--   superadmin → Amina Yusuf

INSERT INTO `admins` (`id`, `name`, `email`, `password`, `role`, `status`, `created_at`, `updated_at`)
VALUES
(101, 'Oluwaseun Adeyemi', 'admin@afx.gov.ng',    '$2y$10$nNyYSphXPYn99Cu1cSB08.jY58N6On2Th/ptp0rlCLSr8GU/qfU6e', 'admin',     'active', NOW(), NOW()),
(102, 'Chidi Okafor',      'chidi@afx.gov.ng',    '$2y$10$b4078yOO4FBtIs9zuJPyJupE3EVvAEoYkymk5VuhyK0tmvW6cjt.e', 'admin',     'active', NOW(), NOW()),
(103, 'Blessing Eze',      'blessing@afx.gov.ng', '$2y$10$7954JaiLLluW1ZtOrYYTKuje6kR57x4c5u8K6RxwP7iFINxVRbV8O', 'admin', 'active', NOW(), NOW()),
(104, 'Amina Yusuf',       'superadmin@afx.gov.ng', '$2y$10$BOMAK20UY.oU3biu08vrlOO9sVXPMWTa80FmTXA02YoY13DU9uK7G', 'super_admin', 'active', NOW(), NOW()),
(105, 'Oluwaseun Adeyemi', 'admin@adm.gov.ng',    '$2y$10$nNyYSphXPYn99Cu1cSB08.jY58N6On2Th/ptp0rlCLSr8GU/qfU6e', 'admin',     'active', NOW(), NOW()),
(106, 'Chidi Okafor',      'chidi@adm.gov.ng',    '$2y$10$b4078yOO4FBtIs9zuJPyJupE3EVvAEoYkymk5VuhyK0tmvW6cjt.e', 'admin',     'active', NOW(), NOW()),
(107, 'Blessing Eze',      'blessing@adm.gov.ng', '$2y$10$7954JaiLLluW1ZtOrYYTKuje6kR57x4c5u8K6RxwP7iFINxVRbV8O', 'admin', 'active', NOW(), NOW()),
(108, 'Amina Yusuf',       'superadmin@adm.gov.ng', '$2y$10$BOMAK20UY.oU3biu08vrlOO9sVXPMWTa80FmTXA02YoY13DU9uK7G', 'super_admin', 'active', NOW(), NOW());
