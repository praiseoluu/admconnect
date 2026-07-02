-- seeds/lgas.sql
-- All 20 Lagos State LGAs matching the mock data IDs exactly

INSERT INTO `lgas` (`id`, `name`, `state`, `is_capital`) VALUES
(1,  'Agege',             'Lagos', FALSE),
(2,  'Ajeromi-Ifelodun',  'Lagos', FALSE),
(3,  'Alimosho',          'Lagos', FALSE),
(4,  'Amuwo-Odofin',      'Lagos', FALSE),
(5,  'Apapa',             'Lagos', FALSE),
(6,  'Badagry',           'Lagos', FALSE),
(7,  'Epe',               'Lagos', FALSE),
(8,  'Eti-Osa',           'Lagos', FALSE),
(9,  'Ibeju-Lekki',       'Lagos', FALSE),
(10, 'Ifako-Ijaiye',      'Lagos', FALSE),
(11, 'Ikeja',             'Lagos', TRUE),
(12, 'Ikorodu',           'Lagos', FALSE),
(13, 'Kosofe',            'Lagos', FALSE),
(14, 'Lagos Island',      'Lagos', FALSE),
(15, 'Lagos Mainland',    'Lagos', FALSE),
(16, 'Mushin',            'Lagos', FALSE),
(17, 'Ojo',               'Lagos', FALSE),
(18, 'Oshodi-Isolo',      'Lagos', FALSE),
(19, 'Shomolu',           'Lagos', FALSE),
(20, 'Surulere',          'Lagos', FALSE);
