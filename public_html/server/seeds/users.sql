-- seeds/users.sql
-- Seed users matching the mock data credentials.
-- Passwords are bcrypt-hashed versions of the plaintext credentials.
-- Plaintext → bcrypt hash (cost 10):
--   citizen1           → generated below
--   citizen2           → generated below
--   etc.
--
-- To re-generate hashes in PHP:
--   echo password_hash('citizen1', PASSWORD_BCRYPT);

-- ⚠️  IMPORTANT: Replace the $2y$... values with freshly generated bcrypt hashes.
--    The placeholders below are structural only — they will NOT verify.
--    Run this PHP snippet once to get real hashes:
--
--    <?php
--    $users = [
--        'citizen1', 'citizen2', 'citizen3', 'citizen4', 'citizen5',
--        'citizen_suspended', 'citizen_pending', 'citizen_nologin'
--    ];
--    foreach ($users as $p) {
--        echo "$p => " . password_hash($p, PASSWORD_BCRYPT) . "\n";
--    }
--
--    Then replace BCRYPT('citizen1') etc. with the actual hash strings.

INSERT INTO `users`
    (`id`, `name`, `email`, `phone`, `password`,
     `lga_id`, `lga_name`, `role`, `is_verified`, `status`,
     `has_seen_welcome`, `profile_visibility`, `two_fa_enabled`,
     `notif_official`, `notif_community`, `notif_lga_alerts`,
     `created_at`, `updated_at`)
VALUES
-- id=1  Adaeze Okonkwo — citizen1 — Ikeja — active/verified
(1,  'Adaeze Okonkwo',   NULL,                  '+2348031234567',
     '$2y$10$8WAJz5iX3LNwruZSnt0AA..KaivTSLhdtJX1gFZe8/bRVwbTmnzDW',
     11, 'Ikeja',   'citizen', 1, 'active',   1, 'public',  0, 1, 1, 0,
     '2024-11-15 09:23:00', NOW()),

-- id=2  Emeka Nwosu — citizen2 — Alimosho — active/verified
(2,  'Emeka Nwosu',      NULL,                  '+2348059876543',
     '$2y$10$PSwKNUvpoKcKYeAuqihko.ADrYTM/7t64pNp29z8z0JKIhx4Z0Vb2',
     3,  'Alimosho', 'citizen', 1, 'active',   0, 'public',  0, 1, 1, 0,
     '2024-12-01 11:00:00', NOW()),

-- id=3  Fatima Bello — citizen_suspended — Eti-Osa — SUSPENDED
(3,  'Fatima Bello',     NULL,                  '+2348121112233',
     '$2y$10$DzdCdLeIabjAYD5WMVZAZ.uyl70ZsEYUeA2vZC6kYjuso3AiENFE6',
     8,  'Eti-Osa',  'citizen', 0, 'suspended', 0, 'public',  0, 1, 1, 0,
     '2025-01-20 16:45:00', NOW()),

-- id=4  Chukwuemeka Eze — citizen3 — Ikeja — active/verified (has email)
(4,  'Chukwuemeka Eze',  'emeka@example.com',   '+2347045556677',
     '$2y$10$3tY9TH5vhNGJApD3wEwndeIYMec2PmMQuAag6SaGMDrp0LuvHQ7dW',
     11, 'Ikeja',   'citizen', 1, 'active',   1, 'public',  0, 1, 1, 0,
     '2025-02-05 08:15:00', NOW()),

-- id=5  Ngozi Adeyemi — citizen4 — Surulere — active/verified
(5,  'Ngozi Adeyemi',    NULL,                  '+2348167778899',
     '$2y$10$XNLRdCNCKn9v74QQPobfvuHMQKGwTdqKDIq81PXL7ExcwQV3l/8l6',
     20, 'Surulere', 'citizen', 1, 'active',   1, 'public',  0, 1, 1, 0,
     '2025-03-10 13:30:00', NOW()),

-- id=6  Segun Lawal — citizen_pending — Lagos Mainland — UNVERIFIED/PENDING
(6,  'Segun Lawal',      NULL,                  '+2348033334455',
     '$2y$10$XpYssCQbTuYFdKxUAlQgkeprErERooVVIuMpYETTj4MagNTYVQX12',
     15, 'Lagos Mainland', 'citizen', 0, 'pending', 0, 'public', 0, 1, 1, 0,
     '2025-04-01 10:00:00', NOW()),

-- id=7  Amina Yusuf — citizen5 — Apapa — active/verified (has email)
(7,  'Amina Yusuf',      'amina@example.com',   '+2347011122233',
     '$2y$10$mzonf9.ezCCffxe/yFCnXuGrV0L9n3fKinSBbwdu1I8mnb3EojQ7i',
     5,  'Apapa',   'citizen', 1, 'active',   1, 'public',  0, 1, 1, 0,
     '2025-01-08 09:00:00', NOW()),

-- id=8  Obinna Obi — no login in mock — Ikorodu — active/verified
(8,  'Obinna Obi',       NULL,                  '+2348099988877',
     '$2y$10$CT.L0ZfNJXcnLFCUZpv9TO66mLdD25tNRCQ3IeMCMfTfWSx5Zl7oy',
     12, 'Ikorodu', 'citizen', 1, 'active',   1, 'public',  0, 1, 1, 0,
     '2024-10-30 14:20:00', NOW());
