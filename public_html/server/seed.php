<?php
/**
 * ADM Connect — End-to-End Test Data Seed
 * =========================================
 * ⚠  DEVELOPMENT / STAGING USE ONLY — delete before production.
 *
 * Usage (CLI): php server/seed.php
 * Usage (web): GET /server/seed.php
 *
 * LGAs are NOT touched — assumes they are already seeded.
 *
 * Test credentials
 * ────────────────
 * Super admin  aliyu@admconnect.com      Admin@1234
 * Admin        fatima@admconnect.com     Admin@1234
 * Citizen 1    abdullahi@adm.test        Citizen@1234   Yola North LGA
 * Citizen 2    zainab@adm.test           Citizen@1234   Numan LGA
 * Citizen 3    kabiru@adm.test           Citizen@1234   Mubi North LGA
 * Citizen 4    maryam@adm.test           Citizen@1234   Yola South LGA
 * Citizen 5    usman@adm.test            Citizen@1234   Ganye LGA
 */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '1');
require_once __DIR__ . '/config/database.php';

$db = Database::connect();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function q(PDO $db, string $sql, array $p = []): void { $db->prepare($sql)->execute($p); }
function h(string $pw): string { return password_hash($pw, PASSWORD_BCRYPT); }
function ts(int $offset = 0): string { return date('Y-m-d H:i:s', time() + $offset); }

$W = fn(string $s) => print($s . "\n");

// ── Truncate (LGAs preserved) ──────────────────────────────────────────────
$W('Truncating…');
$db->exec('SET FOREIGN_KEY_CHECKS=0');
foreach ([
    'reel_subscriptions','reel_reports','reel_comments','reel_likes',
    'reel_lga_targets','notifications','chat_reports','lga_chat_messages',
    'chat_last_read','advert_lga_targets','adverts','news_lga_targets',
    'news','reels','users','admins','banned_words',
] as $t) { $db->exec("TRUNCATE TABLE `{$t}`"); }
$db->exec('SET FOREIGN_KEY_CHECKS=1');

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADMINS
// ─────────────────────────────────────────────────────────────────────────────
$W('Admins…');
$ap = h('Admin@1234');
q($db,'INSERT INTO admins (id,name,email,password,role,handle,status) VALUES (?,?,?,?,?,?,?)',
  [100001,'Aliyu Mohammed','aliyu@admconnect.com',$ap,'super_admin','aliyu_m','active']);
q($db,'INSERT INTO admins (id,name,email,password,role,handle,status) VALUES (?,?,?,?,?,?,?)',
  [100002,'Fatima Hassan','fatima@admconnect.com',$ap,'admin','fatima_h','active']);

// ─────────────────────────────────────────────────────────────────────────────
// 2. CITIZENS
// ─────────────────────────────────────────────────────────────────────────────
$W('Citizens…');
$cp = h('Citizen@1234');
$citizens = [
  [100001,'Abdullahi Musa','abdullahi_m','abdullahi@adm.test','+2348031234001','male',   1,'Yola North','Yola',   'central','1992-04-15','https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs'],
  [100002,'Zainab Usman',  'zainab_u',  'zainab@adm.test',  '+2348031234002','female',  2,'Numan',     'Numan',     'south', '1996-08-22','https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k'],
  [100003,'Kabiru Ibrahim','kabiru_i',  'kabiru@adm.test',  '+2348031234003','male',    3,'Mubi North', 'Mubi',    'north', '1990-01-30','https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU'],
  [100004,'Maryam Sani',   'maryam_s',  'maryam@adm.test',  '+2348031234004','female',  4,'Yola South', 'Yola',    'central','1998-11-05','https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI'],
  [100005,'Usman Tukur',   'usman_t',   'usman@adm.test',   '+2348031234005','male',    5,'Ganye',      'Ganye',   'south', '1994-06-18','https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY'],
];
$us = $db->prepare('INSERT INTO users (id,name,username,email,phone,gender,password,lga_id,lga_name,region,
  city,state,dob,avatar_url,role,is_verified,status,has_seen_welcome,
  notif_official,notif_community,notif_lga_alerts,notif_new_login,
  notif_reel_likes,notif_reel_comments,notif_breaking_news,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
foreach ($citizens as [$id,$name,$uname,$email,$phone,$gender,$lgaId,$lgaName,$city,$region,$dob,$avatar]) {
  $us->execute([$id,$name,$uname,$email,$phone,$gender,$cp,$lgaId,$lgaName,$region,
    $city,'Adamawa State',$dob,$avatar,'citizen',1,'active',1,1,1,1,1,1,1,1,ts()]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NEWS
// LGA groupings (all 34 covered):
//   A – Northern border : 2,7,8,9,10,25
//   B – Eastern cluster : 12,13,15,20,22,24,32
//   C – Funtua zone     : 3,4,16,19,33
//   D – Dutsin-Ma zone  : 5,23,28,29,30,31
//   E – Katsina metro   : 1,14,17,18,34
//   F – Western cluster : 6,11,21,26,27
// ─────────────────────────────────────────────────────────────────────────────
$W('News…');

// Helper: insert a news row and return its id
$newsStmt = $db->prepare('INSERT INTO news
  (id,slug,title,summary,body,category,breaking,is_headline,target_all_lgas,status,
   image_url,author_id,lga_id,lga_name,delivery_push,delivery_email,published_at,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

$nid = 100001; // auto-increment start
$news = [
  // ── ALL-LGA articles (4) ──────────────────────────────────────────────────
  [$nid++, 'governor-digital-literacy-launch',
   'Governor Radda Launches KatsinaTech 2025 Digital Literacy Drive',
   '50,000 Katsina youth across all 34 LGAs to receive free digital skills training.',
   '<p>Governor Dikko Umar Radda today launched KatsinaTech 2025 at Government House, Katsina. The initiative equips 50,000 young residents with web development, data analysis, and digital marketing skills. Training centres will operate in every LGA headquarters starting next month.</p>',
   'Technology',1,1,1,'published','https://picsum.photos/id/180/800/450.jpg',100001,null,null,ts(-86400*4)],

  [$nid++, 'meningitis-vaccination-statewide',
   'Free Meningitis Vaccination Campaign Begins Monday Across All LGAs',
   'Katsina State Ministry of Health launches emergency vaccination drive in all 34 LGAs.',
   '<p>The Katsina State Ministry of Health has announced a state-wide free meningitis vaccination campaign commencing Monday. Mobile health teams will visit every LGA headquarters and major wards. Citizens aged 2–30 are strongly encouraged to participate. The campaign runs for three weeks.</p>',
   'Health',1,0,1,'published','https://picsum.photos/id/509/800/450.jpg',100002,null,null,ts(-86400*3)],

  [$nid++, 'state-scholarship-applications-open',
   'Katsina Scholarship Board Opens 2025/2026 Applications — Deadline 31 Aug',
   'Scholarships for undergraduate, postgraduate, and overseas study now available to all Katsina indigenes.',
   '<p>The Katsina State Scholarship Board has opened applications for the 2025/2026 session. Awards cover Nigerian universities, polytechnics, colleges of education, and limited overseas postgraduate slots. Minimum requirement: five WAEC/NECO credits including English and Maths. Apply at the Board portal before August 31st.</p>',
   'Education',0,0,1,'published','https://picsum.photos/id/20/800/450.jpg',100002,null,null,ts(-86400*2)],

  [$nid++, 'gubernatorial-quarterly-address',
   'Governor\'s Q2 Address: ₦12 Billion Infrastructure Budget on Track',
   'Governor Radda delivers mid-year briefing on infrastructure, security, and economic development.',
   '<p>In his second quarter address, Governor Dikko Umar Radda confirmed that ₦12 billion in infrastructure expenditure is progressing as scheduled. Key milestones include the Katsina–Jibia dual carriageway at 60% completion, 14 rehabilitated roads across the state, and the commissioning of two new primary health centres in Daura and Funtua LGAs.</p>',
   'Politics',0,1,1,'published','https://picsum.photos/id/365/800/450.jpg',100001,null,null,ts(-86400*1)],

  // ── GROUPED articles (6) ─────────────────────────────────────────────────
  [$nid++, 'northern-border-road-upgrade',
   'Federal Government Approves Road Upgrade for Six Northern Border LGAs',
   'Daura, Jibia, Kaita, Mashi, Zango, and Mai\'Adua to benefit from ₦4.2 billion road grant.',
   '<p>The Federal Ministry of Works has approved a ₦4.2 billion road rehabilitation grant covering the six LGAs that share an international border with Niger Republic. The Daura–Kongolam–Katsina Highway is first on the list, followed by the Zango–Mashi trunk road. Construction is expected to begin in Q4.</p>',
   'Infrastructure',0,0,0,'published','https://picsum.photos/id/317/800/450.jpg',100001,null,null,ts(-86400*5)],

  [$nid++, 'eastern-cluster-agricultural-extension',
   'Agricultural Extension Officers Deployed to Seven Eastern LGAs',
   'Baure, Bindawa, Dan Musa, Ingawa, Kankia, Kusada, and Sandamu get dedicated farm advisers.',
   '<p>The Katsina State Agricultural Development Authority (KTARDA) has deployed a new cohort of agricultural extension officers to seven eastern LGAs. Each officer is responsible for up to 200 registered farming households. Training on improved groundnut varieties and soil conservation techniques begins this week.</p>',
   'Agriculture',0,0,0,'published','https://picsum.photos/id/145/800/450.jpg',100001,null,null,ts(-86400*6)],

  [$nid++, 'funtua-zone-water-project',
   'New Borehole Network to Serve 120,000 Residents in Funtua Zone',
   'Funtua, Malumfashi, Dandume, Faskari, and Bakori to get 45 new boreholes by December.',
   '<p>A World Bank-funded rural water supply project will install 45 solar-powered boreholes across five LGAs in the Funtua zone. The ₦2.1 billion project is implemented by the Katsina State Rural Water Supply and Sanitation Agency (RUWASSA) and is expected to benefit approximately 120,000 rural residents who currently rely on seasonal streams.</p>',
   'Infrastructure',0,0,0,'published','https://picsum.photos/id/137/800/450.jpg',100002,null,null,ts(-86400*5)],

  [$nid++, 'dutsin-ma-zone-youth-employment',
   'Youth Employment Initiative Launched in Dutsin-Ma Zone',
   'Dutsin-Ma, Kurfi, Musawa, Rimi, Sabuwa, and Safana benefit from 1,200 apprenticeship places.',
   '<p>Under the Federal Government\'s NSIP Youth Employment Programme, 1,200 apprenticeship placements have been allocated to six LGAs in the Dutsin-Ma zone. Trades covered include electrical installation, welding, tailoring, and phone repair. Registration opens at each LGA secretariat from Monday.</p>',
   'Economy',0,0,0,'published','https://picsum.photos/id/96/800/450.jpg',100002,null,null,ts(-86400*4)],

  [$nid++, 'katsina-metro-flood-warning',
   'Emergency Flood Alert: Metro LGAs Urged to Clear Drainage Channels',
   'Katsina, Batagarawa, Charanchi, Danja, and Dutsi on yellow flood watch for the coming week.',
   '<p>The Katsina State Emergency Management Agency (SEMA) has issued a yellow flood watch for five LGAs in the Katsina metropolitan cluster. Residents are urged to clear drainage channels and avoid building on waterways. The Nigeria Meteorological Agency (NiMet) projects above-average rainfall in the region through mid-August.</p>',
   'Security',1,0,0,'published','https://picsum.photos/id/252/800/450.jpg',100001,null,null,ts(-3600*16)],

  [$nid++, 'western-cluster-security-patrol',
   'Joint Security Patrol Intensified in Kankara, Batsari, Kafur, Mani, and Matazu',
   'Army, Police, and Vigilante group launch coordinated 30-day patrol in western Katsina.',
   '<p>Following a directive from the Katsina State Security Council, a joint patrol operation codenamed "Operation Clear Road West" has been launched across five western LGAs. The 30-day operation involves Nigerian Army troops, Police Mobile Force, and Local Vigilante groups. Residents are asked to report suspicious movements via the Katsina Security Hotline: 0800-KATSINA.</p>',
   'Security',1,0,0,'published','https://picsum.photos/id/429/800/450.jpg',100001,null,null,ts(-3600*8)],

  // ── LGA-SPECIFIC articles (12) ───────────────────────────────────────────
  [$nid++, 'katsina-road-completion',
   '14 Road Projects Reach Completion Ahead of Schedule in Katsina LGA',
   '47 km of roads across Katsina metropolis now complete, 6 more underway.',
   '<p>The Katsina State Ministry of Works confirmed 14 of 20 road rehabilitation projects in Katsina LGA are complete. Areas covered include Tudun Wada, Kofar Kaura, and Unguwar Alkali. The remaining six projects target Kofar Marusa and Yanduna wards and are expected to wrap up by September.</p>',
   'Infrastructure',1,0,0,'published','https://picsum.photos/id/317/800/450.jpg',100001,1,'Katsina',ts(-86400*7)],

  [$nid++, 'daura-heritage-festival-2025',
   'Daura International Heritage Festival Returns — October 10–12',
   'The annual festival celebrating the Bayajidda legend returns with cultural exhibitions and international guests.',
   '<p>The Daura International Heritage Festival will hold October 10–12 at the Daura Emirate grounds. This year\'s edition features a new archaeology exhibition showcasing finds from the ancient Daura walled city, traditional horse display (Durbar), and a cultural trade fair. International guests from Niger, Mali, and the diaspora are expected.</p>',
   'Culture',0,0,0,'published','https://picsum.photos/id/484/800/450.jpg',100002,2,'Daura',ts(-86400*3)],

  [$nid++, 'funtua-agricultural-fair',
   '12th Annual Funtua Agricultural & Trade Fair — Registration Now Open',
   'October 15–18 at Funtua Trade Centre. Over 200 exhibitors expected.',
   '<p>The Funtua Local Government Agricultural Development Office announces the 12th Annual Agricultural and Trade Fair, October 15–18 at the Funtua Trade Centre. Exhibitors include cotton farmers, groundnut cooperatives, and input suppliers. A special livestock auction is scheduled for October 17. Register before September 30 at the LGA Secretariat.</p>',
   'Agriculture',0,0,0,'published','https://picsum.photos/id/145/800/450.jpg',100001,3,'Funtua',ts(-3600*5)],

  [$nid++, 'malumfashi-textile-revival',
   'Malumfashi Textile Factory Revival: 800 Jobs Available',
   'The long-dormant Malumfashi Textile Mill to reopen under new management in Q4.',
   '<p>The Katsina State Government and a Lagos-based consortium have finalised a concession agreement to reopen the Malumfashi Textile Mill, dormant since 2009. The first phase will create 800 direct jobs. Governor Radda described the deal as "the most significant private investment in Malumfashi in two decades." Recruitment begins October.</p>',
   'Economy',0,0,0,'published','https://picsum.photos/id/404/800/450.jpg',100002,4,'Malumfashi',ts(-86400*2)],

  [$nid++, 'dutsin-ma-fudma-expansion',
   'FUDMA Gets ₦800 Million Federal Grant for Campus Expansion',
   'Federal University Dutsin-Ma to build two new faculties and a 1,000-bed hostel.',
   '<p>Federal University Dutsin-Ma (FUDMA) has received an ₦800 million Tertiary Education Trust Fund (TETFund) grant for a major campus expansion. Construction of the new Faculty of Engineering building and a Faculty of Environmental Sciences block begins in September. A 1,000-bed student hostel is also part of the project.</p>',
   'Education',0,0,0,'published','https://picsum.photos/id/250/800/450.jpg',100001,5,'Dutsin-Ma',ts(-86400*4)],

  [$nid++, 'jibia-border-trade-revival',
   'Jibia Border Customs Post Records ₦2.1 Billion in August Revenue',
   'Record monthly collection at the Jibia border crossing as livestock trade surges.',
   '<p>The Jibia Area Command of the Nigeria Customs Service recorded ₦2.1 billion in August — its highest monthly collection on record. The surge is attributed to increased cattle and goat exports to Niger Republic following the new bilateral livestock trade framework signed in June. The figure represents a 34% year-on-year increase.</p>',
   'Economy',0,0,0,'published','https://picsum.photos/id/338/800/450.jpg',100002,7,'Jibia',ts(-86400*1)],

  [$nid++, 'kankara-solar-farm-commissioning',
   'Kankara 20MW Solar Farm Commissioned — 15,000 Homes to Benefit',
   'Katsina\'s second utility-scale solar power project officially goes live.',
   '<p>Governor Radda commissioned the Kankara 20-megawatt solar power project on Wednesday, the second utility-scale solar farm in Katsina State. The project, financed through the Presidential Artisanal Gold Mining Initiative fund, will supply power to approximately 15,000 homes in Kankara and neighbouring Batsari LGAs. Connection to the national grid is expected within six weeks.</p>',
   'Technology',0,0,0,'published','https://picsum.photos/id/96/800/450.jpg',100001,6,'Kankara',ts(-3600*20)],

  [$nid++, 'baure-irrigation-scheme',
   'Baure Fadama Irrigation Scheme: 3,000 Hectares Brought Under Cultivation',
   'New irrigation infrastructure opens large-scale dry-season farming in Baure.',
   '<p>The Lower Rima and Niger River Basins Development Authority has completed Phase 2 of the Baure Fadama Irrigation Scheme, bringing 3,000 hectares of land under perennial irrigation for the first time. Participating farmers will grow rice, maize, and vegetables during the dry season, providing year-round income for an estimated 4,500 households.</p>',
   'Agriculture',0,0,0,'published','https://picsum.photos/id/292/800/450.jpg',100002,12,'Baure',ts(-86400*5)],

  [$nid++, 'mashi-primary-health-centre',
   'New Primary Health Centre Opens in Mashi — Serving 30,000 Residents',
   'The 12-bed facility is the first new health centre in Mashi LGA in 18 years.',
   '<p>A brand-new 12-bed primary health centre equipped with a maternity wing, laboratory, and pharmacy was commissioned in Mashi LGA on Friday. The ₦180 million project was funded by the Basic Healthcare Provision Fund (BHCPF). The facility is expected to serve approximately 30,000 residents from Mashi town and surrounding villages, reducing the nearest referral distance from 45 km to 8 km.</p>',
   'Health',0,0,0,'published','https://picsum.photos/id/509/800/450.jpg',100001,9,'Mashi',ts(-86400*6)],

  [$nid++, 'zango-youth-football-league',
   'Zango FA League Season Kicks Off with 16 Teams',
   'The Zango Football Association launches its most competitive league season yet.',
   '<p>Sixteen youth teams from across Zango LGA kicked off the 2025 FA League season at the Zango Township Stadium on Saturday. The competition, funded by a community development levy, features players aged 16–25. The winner earns automatic entry into the Katsina State FA League qualifiers. Matches every Saturday and Sunday until November.</p>',
   'Sports',0,0,0,'published','https://picsum.photos/id/122/800/450.jpg',100002,10,'Zango',ts(-86400*2)],

  [$nid++, 'rimi-community-forest-programme',
   'Rimi LGA Launches 10,000-Tree Community Forest Programme',
   'Schools, youth clubs, and ward councils to plant and maintain 10,000 trees across Rimi.',
   '<p>Rimi LGA has launched a community-driven afforestation drive targeting 10,000 trees by December 2025. The programme is coordinated by the Rimi Environmental Committee in partnership with the Katsina State Forestry Department. Each participating ward is responsible for a 200-tree nursery. Drought-resistant species including neem, dawadawa, and gmelina are being prioritised.</p>',
   'Environment',0,0,0,'published','https://picsum.photos/id/137/800/450.jpg',100001,29,'Rimi',ts(-86400*3)],

  [$nid++, 'draft-malumfashi-census',
   '[DRAFT] Malumfashi Population Estimates — Internal Working Document',
   'Awaiting verification from NPC before publication.',
   '<p>Draft — not approved for release.</p>',
   'Official',0,0,0,'draft',null,100002,4,'Malumfashi',null],
];

foreach ($news as $n) {
  $newsStmt->execute([
    $n[0],$n[1],$n[2],$n[3],$n[4],$n[5],$n[6],$n[7],$n[8],$n[9],
    $n[10],$n[11],$n[12],$n[13],1,0,$n[14] ?? null,ts(),
  ]);
}

// news_lga_targets (grouped + specific)
$nlt = $db->prepare('INSERT IGNORE INTO news_lga_targets (news_id, lga_id) VALUES (?,?)');
// Group A – Northern border (news id 100005)
foreach ([2,7,8,9,10,25] as $l) $nlt->execute([100005,$l]);
// Group B – Eastern cluster (100006)
foreach ([12,13,15,20,22,24,32] as $l) $nlt->execute([100006,$l]);
// Group C – Funtua zone (100007)
foreach ([3,4,16,19,33] as $l) $nlt->execute([100007,$l]);
// Group D – Dutsin-Ma zone (100008)
foreach ([5,23,28,29,30,31] as $l) $nlt->execute([100008,$l]);
// Group E – Katsina metro (100009)
foreach ([1,14,17,18,34] as $l) $nlt->execute([100009,$l]);
// Group F – Western cluster (100010)
foreach ([6,11,21,26,27] as $l) $nlt->execute([100010,$l]);
// LGA-specific articles
foreach ([
  [100011,1],[100012,2],[100013,3],[100014,4],[100015,5],
  [100016,7],[100017,6],[100018,12],[100019,9],[100020,10],
  [100021,29],
] as [$newsId,$lgaId]) $nlt->execute([$newsId,$lgaId]);

// ─────────────────────────────────────────────────────────────────────────────
// 4. ADVERTS  (banner / interstitial / news / feed — all location types)
// ─────────────────────────────────────────────────────────────────────────────
$W('Adverts…');
$ad = $db->prepare('INSERT INTO adverts
  (id,title,advertiser,description,cta_label,cta_url,image_url,type,status,
   target_all_lgas,start_date,end_date,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');

$sDate = date('Y-m-d',strtotime('-7 days'));
$eDate = date('Y-m-d',strtotime('+60 days'));

$adverts = [
  // ── BANNER — all LGAs ────────────────────────────────────────────────────
  [100001,'Katsina Agricultural Bank — Harvest Loan Scheme',
   'Katsina State Agricultural Development Bank',
   'Low-interest farming loans available to all registered farmers. Apply before the planting season.',
   'Apply Now','https://admconnect.com',
   'https://picsum.photos/id/292/800/400.jpg','banner','active',1,$sDate,$eDate],

  [100002,'FUDMA — Admissions 2025/2026 Open',
   'Federal University Dutsin-Ma',
   'Undergraduate and postgraduate admissions now open. Apply via JAMB CAPS.',
   'Check Status','https://admconnect.com',
   'https://picsum.photos/id/250/800/400.jpg','banner','active',1,
   date('Y-m-d',strtotime('-3 days')),date('Y-m-d',strtotime('+90 days'))],

  [100003,'MTN Katsina — Double Data Every Friday',
   'MTN Nigeria',
   'Enjoy 2× data on all recharge amounts every Friday. Dial *131*1# to activate.',
   'Activate Now','https://admconnect.com',
   'https://picsum.photos/id/96/800/400.jpg','banner','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+30 days'))],

  [100004,'Invest in Katsina Free Trade Zone',
   'Katsina State Investment Promotion Agency',
   'Industrial land with tax holidays and full infrastructure support. Download the prospectus.',
   'Download Prospectus','https://admconnect.com',
   'https://picsum.photos/id/338/800/400.jpg','banner','active',1,
   date('Y-m-d',strtotime('-14 days')),date('Y-m-d',strtotime('+45 days'))],

  // ── BANNER — LGA-specific ────────────────────────────────────────────────
  [100005,'Katsina City Mall — Grand Opening',
   'Katsina City Mall Ltd',
   'Opening October 1st. 120 shops, cinema, food court. First 500 visitors get a free gift.',
   'Get Directions','https://admconnect.com',
   'https://picsum.photos/id/404/800/400.jpg','banner','active',0,
   date('Y-m-d',strtotime('-2 days')),date('Y-m-d',strtotime('+28 days'))],

  [100006,'Daura Heritage Festival 2025 — Book Your Stay',
   'Daura Emirate Hotel',
   'Official accommodation partner for the Daura International Heritage Festival. Book early.',
   'Book Now','https://admconnect.com',
   'https://picsum.photos/id/484/800/400.jpg','banner','active',0,
   date('Y-m-d'),date('Y-m-d',strtotime('+40 days'))],

  // ── BANNER — group of LGAs ───────────────────────────────────────────────
  [100007,'Funtua Zone Cooperative Bank — Join Today',
   'Funtua Zone Cooperative Credit Society',
   'Serving farmers and traders in Funtua, Malumfashi, Bakori, Dandume, and Faskari. Low-rate loans.',
   'Join the Co-op','https://admconnect.com',
   'https://picsum.photos/id/145/800/400.jpg','banner','active',0,
   date('Y-m-d',strtotime('-5 days')),date('Y-m-d',strtotime('+55 days'))],

  // ── INTERSTITIAL — all LGAs ──────────────────────────────────────────────
  [100008,'Register to Vote — 2027 Governorship Election',
   'Independent National Electoral Commission (INEC)',
   'Continuous Voter Registration is ongoing. Visit your nearest INEC office or use the INEC portal.',
   'Register Online','https://admconnect.com',
   'https://picsum.photos/id/365/800/600.jpg','interstitial','active',1,
   date('Y-m-d',strtotime('-10 days')),date('Y-m-d',strtotime('+180 days'))],

  [100009,'Katsina Anti-Drug Campaign — Say No to Tramadol',
   'National Drug Law Enforcement Agency (NDLEA)',
   'The misuse of prescription drugs is destroying lives. Report drug abuse: 0800-NDLEA-00.',
   'Learn More','https://admconnect.com',
   'https://picsum.photos/id/509/800/600.jpg','interstitial','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+120 days'))],

  // ── INTERSTITIAL — group of LGAs ────────────────────────────────────────
  [100010,'Northern LGA Trade Fair — Daura, October 20–22',
   'Daura LGA Commerce & Industry Board',
   'The Northern Katsina Trade Fair brings together buyers and sellers from 6 border LGAs.',
   'Register as Exhibitor','https://admconnect.com',
   'https://picsum.photos/id/429/800/600.jpg','interstitial','active',0,
   date('Y-m-d',strtotime('-1 day')),date('Y-m-d',strtotime('+25 days'))],

  // ── NEWS type — all LGAs ────────────────────────────────────────────────
  [100011,'Katsina State Health Insurance — Enrol Free Before September',
   'Katsina State Contributory Health Management Agency',
   'All civil servants and their families are entitled to free enrolment. Deadline September 30.',
   'Enrol Now','https://admconnect.com',
   'https://picsum.photos/id/122/800/300.jpg','news','active',1,
   date('Y-m-d',strtotime('-4 days')),date('Y-m-d',strtotime('+35 days'))],

  [100012,'Glo Katsina Special — ₦200 Recharge Gets ₦500 Value',
   'Glo Mobile Nigeria',
   'Exclusive offer for Katsina subscribers. Buy ₦200 airtime and get ₦500 value till Sunday.',
   'Buy Airtime','https://admconnect.com',
   'https://picsum.photos/id/96/800/300.jpg','news','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+7 days'))],

  // ── NEWS type — LGA-specific ─────────────────────────────────────────────
  [100013,'Malumfashi Textile Mill Jobs — Apply Before August 31',
   'Malumfashi Textile Concession Partners Ltd',
   '800 jobs in weaving, dyeing, quality control, and administration. Applicants must be Malumfashi indigenes.',
   'Download Form','https://admconnect.com',
   'https://picsum.photos/id/252/800/300.jpg','news','active',0,
   date('Y-m-d',strtotime('-2 days')),date('Y-m-d',strtotime('+14 days'))],

  // ── FEED type — all LGAs ────────────────────────────────────────────────
  [100014,'Airtel Katsina — 10GB for ₦1,000 Monthly Plan',
   'Airtel Nigeria',
   'Get 10GB valid for 30 days for just ₦1,000. Dial *141*1# to activate on any Airtel line.',
   'Activate','https://admconnect.com',
   'https://picsum.photos/id/484/800/400.jpg','feed','active',1,
   date('Y-m-d'),date('Y-m-d',strtotime('+30 days'))],

  [100015,'Katsina Teachers Recruitment — 2,000 Positions Available',
   'Katsina State Universal Basic Education Board (SUBEB)',
   'Teaching positions open across all 34 LGAs. Minimum qualification: NCE. Apply at SUBEB office.',
   'Apply Now','https://admconnect.com',
   'https://picsum.photos/id/20/800/400.jpg','feed','active',1,
   date('Y-m-d',strtotime('-3 days')),date('Y-m-d',strtotime('+60 days'))],

  // ── FEED type — group of LGAs ───────────────────────────────────────────
  [100016,'Dutsin-Ma Zone Cooperative Fair — September 28',
   'Dutsin-Ma LGA Commerce Office',
   'A one-day market for agricultural cooperatives in Dutsin-Ma, Kurfi, Musawa, Rimi, Sabuwa, and Safana.',
   'Get Directions','https://admconnect.com',
   'https://picsum.photos/id/317/800/400.jpg','feed','active',0,
   date('Y-m-d',strtotime('-6 days')),date('Y-m-d',strtotime('+20 days'))],

  // ── PAUSED / EXPIRED for UI testing ─────────────────────────────────────
  [100017,'[Paused] Katsina Book Fair 2024',
   'Katsina State Library Board',
   'Annual book fair paused pending venue confirmation.',
   'Learn More','https://admconnect.com',
   null,'banner','paused',1,
   date('Y-m-d',strtotime('-60 days')),date('Y-m-d',strtotime('+30 days'))],

  [100018,'[Expired] Eid-el-Kabir Greetings 2024',
   'Government House Katsina',
   'Wishing all citizens Eid Mubarak.',
   null,'https://admconnect.com',
   'https://picsum.photos/id/122/800/400.jpg','banner','expired',1,
   date('Y-m-d',strtotime('-365 days')),date('Y-m-d',strtotime('-300 days'))],
];

foreach ($adverts as $a) {
  $ad->execute([...$a, ts()]);
}

// advert_lga_targets for non-all-lga ads
$alt = $db->prepare('INSERT IGNORE INTO advert_lga_targets (advert_id, lga_id) VALUES (?,?)');
foreach ([1,14,17,18,34] as $l) $alt->execute([100005,$l]); // Katsina metro
foreach ([2,7,8,9,10,25] as $l) $alt->execute([100006,$l]); // Daura + border
foreach ([3,4,16,19,33]  as $l) $alt->execute([100007,$l]); // Funtua zone
foreach ([2,7,8,9,10,25] as $l) $alt->execute([100010,$l]); // Northern border
$alt->execute([100013,4]);                                    // Malumfashi specific
foreach ([5,23,28,29,30,31] as $l) $alt->execute([100016,$l]); // Dutsin-Ma zone

// ─────────────────────────────────────────────────────────────────────────────
// 5. REELS
// ─────────────────────────────────────────────────────────────────────────────
$W('Reels…');

$videos = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
];

$thumbs = [
  'https://picsum.photos/id/10/640/360.jpg?hmac=CrRjsHrAuJhCbm7bzOtL8VVtAomW-VTsGS0z7-AeL0g',
  'https://picsum.photos/id/28/640/360.jpg?hmac=3ESnpVeqUUCCpxoMpA0QvJjVlpVRpWsHpHcEVWABRWM',
  'https://picsum.photos/id/137/640/360.jpg?hmac=pSa3GXHJ0z5-LRKOmUuL8JIRVMXSdXXHp5n52NJFyBo',
  'https://picsum.photos/id/180/640/360.jpg?hmac=2dNNJf6sL7I-0aHEFNkBNBDMJfBYovuECxnJhFxVH5Y',
  'https://picsum.photos/id/230/640/360.jpg?hmac=c3UqkEJi3Bl2KV62pVKjK-A26pUbMJH9F8t-SXobwsM',
  'https://picsum.photos/id/292/640/360.jpg?hmac=m_MqPSmFMlSmzBbIXfNRHo7mWGNW3cEEIaVWLH-c2e0',
  'https://picsum.photos/id/317/640/360.jpg?hmac=wPb0g1wCnk1oIlFIcjmh3F1bMIPWFtJDxDHipfXB4gg',
  'https://picsum.photos/id/338/640/360.jpg?hmac=r3Ys5P-Rr7E38gvFFlSKGb-RYdnsBw9EiOsTdVMvZMw',
  'https://picsum.photos/id/365/640/360.jpg?hmac=7x1vZVn4T8iNTW0ZbDxrRNqiMPME_1Zby0QQwFb5u9w',
  'https://picsum.photos/id/429/640/360.jpg?hmac=AkjA0J5Xq8sKXHo4wWf1cZPgUkdWp3FZ-j2k2lOCFpc',
  'https://picsum.photos/id/484/640/360.jpg?hmac=wX-4ZsPtFg5SLVmxSbxJgH3Z_LhGWYIGTz5gZEaLjHI',
  'https://picsum.photos/id/509/640/360.jpg?hmac=XjJLr2dAnV0nBBKaHFblxBQk7UvXEW62wYMIPpEFJcg',
  'https://picsum.photos/id/122/640/360.jpg?hmac=Vj9sECBBkLpRZf-0e2YxLJLp_e3X1Wdl3k9Yj_6DRUI',
];

$citizenAvatars = [
  100001=>'https://picsum.photos/id/1005/200/200.jpg?hmac=55ClIvia6NVCHST4QmWEFHAGrE5y6sEDBc_sRMZbONs',
  100002=>'https://picsum.photos/id/1011/200/200.jpg?hmac=yxKRlN0fexcb7AuXQ_OJJY5_nQOJ9-E76BXkuSzRG_k',
  100003=>'https://picsum.photos/id/1012/200/200.jpg?hmac=WzPdEfrwXTVIFVj3E70B5KJkSzWLHFInDOKC8t3k-aU',
  100004=>'https://picsum.photos/id/1027/200/200.jpg?hmac=RLgIwPm9_LfSjqFAKg7HNVhm5laBFfOInSvBFYM9DxI',
  100005=>'https://picsum.photos/id/1074/200/200.jpg?hmac=OV3_E3KZZT1N6aVP8jF5p5mBTuKfNV5fRb_V71FS9gY',
];

// [reel_id, is_admin, lga_id, lga_name, target_all, caption, hashtags, author_id, author_uname, thumb_idx, video_idx, likes, comments, views, published_offset_sec]
$reels = [
  // ── Abdullahi (citizen, Katsina LGA 1) ───────────────────────────────────
  ['reel_001',0,1,'Katsina',0,'Sunrise over Katsina city 🌅 The beauty of the North. #Katsina #NorthernNigeria',
   ['Katsina','NorthernNigeria','Sunrise'],100001,'abdullahi_m',0,0,18,3,142,ts(-86400*7)],
  ['reel_002',0,null,null,1,'Proud to be Katsina! Our governor is working hard for all of us 💪 #KatsinaTech #Nigeria',
   ['KatsinaTech','Nigeria','Proud'],100001,'abdullahi_m',3,1,9,1,67,ts(-86400*3)],

  // ── Zainab (citizen, Daura LGA 2) ────────────────────────────────────────
  ['reel_003',0,2,'Daura',0,'Daura — the cradle of Hausa civilisation 🏰 #Daura #History #HausaKingdoms',
   ['Daura','History','HausaKingdoms'],100002,'zainab_u',1,2,11,2,88,ts(-86400*5)],
  ['reel_004',0,null,null,1,'Sisters in agriculture! Women farmers of Katsina are feeding the nation 🌾 #WomenInAgriculture',
   ['WomenInAgriculture','Katsina','FarmHer'],100002,'zainab_u',4,3,24,4,201,ts(-86400*2)],

  // ── Kabiru (citizen, Funtua LGA 3) ────────────────────────────────────────
  ['reel_005',0,3,'Funtua',0,'Cotton harvest season has arrived in Funtua! 🌿 #Funtua #Cotton #Agriculture',
   ['Funtua','Cotton','Agriculture'],100003,'kabiru_i',2,4,7,1,53,ts(-86400*4)],
  ['reel_006',0,null,null,1,'The youth of Katsina are ready. No more excuses — let\'s build together 💯 #KatsinaYouth',
   ['KatsinaYouth','NorthernNigeria','BuiltByUs'],100003,'kabiru_i',5,0,14,2,109,ts(-86400*1)],

  // ── Maryam (citizen, Katsina LGA 1) ──────────────────────────────────────
  ['reel_007',0,1,'Katsina',0,'Katsina market day — the colours, the energy, the people! ❤️ #KatsinaMarket',
   ['KatsinaMarket','Katsina','NorthLife'],100004,'maryam_s',6,1,6,1,44,ts(-86400*6)],
  ['reel_008',0,2,'Daura',0,'Visiting Daura — every Hausa person\'s spiritual homeland 🕌 #Daura #Travel',
   ['Daura','Travel','Heritage'],100004,'maryam_s',10,2,8,0,61,ts(-86400*3)],

  // ── Usman (citizen, Malumfashi LGA 4) ────────────────────────────────────
  ['reel_009',0,4,'Malumfashi',0,'The old textile mill days are coming back to Malumfashi! 800 jobs! 🎉 #Malumfashi #Jobs',
   ['Malumfashi','Jobs','Textiles'],100005,'usman_t',7,3,21,3,178,ts(-86400*2)],
  ['reel_010',0,null,null,1,'A message from Malumfashi to the world — we\'re on the map! 🗺️ #Katsina #Malumfashi',
   ['Katsina','Malumfashi','Rise'],100005,'usman_t',11,4,5,1,39,ts(-3600*14)],

  // ── Admin reels (is_admin=1) ──────────────────────────────────────────────
  ['reel_011',1,null,null,1,'KTG Connect official reel: Katsina 2025 development highlights 🏛️ #KatsinaGovernment',
   ['KatsinaGovernment','Development','2025'],100001,'aliyu_m',8,0,45,6,512,ts(-86400*10)],
  ['reel_012',1,1,'Katsina',0,'Katsina Road Rehabilitation Progress — official update from the Ministry of Works 🚧',
   ['Infrastructure','Katsina','Works'],100001,'aliyu_m',9,1,32,4,387,ts(-86400*7)],
  ['reel_013',1,null,null,1,'ADM Connect turns 1 year! Thank you Adamawa State 🎂 #ADMConnect #Anniversary',
   ['ADMConnect','Anniversary','Adamawa'],100001,'aliyu_m',12,2,58,8,643,ts(-86400*5)],
];

$rStmt = $db->prepare('INSERT INTO reels
  (reel_id,lga_id,lga_name,target_all_lgas,is_admin,caption,hashtags,video_url,cloudinary_id,
   thumbnail_url,views,likes,comment_count,author_id,author_name,author_handle,
   author_avatar_url,status,allow_comments,published_at,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

foreach ($reels as $r) {
  [$rid,$isAdmin,$lgaId,$lgaName,$targetAll,$caption,$hashtags,
   $authorId,$authorUname,$thumbIdx,$vidIdx,$likes,$commentCount,$views,$pubAt] = $r;
  $rStmt->execute([
    $rid,$lgaId,$lgaName,$targetAll,$isAdmin,$caption,json_encode($hashtags),
    $videos[$vidIdx % count($videos)],'seed/sample_'.$thumbIdx.'.mp4',
    $thumbs[$thumbIdx % count($thumbs)],
    $views,$likes,$commentCount,
    $authorId,$authorUname,$authorUname,$citizenAvatars[$authorId] ?? null,
    'published',1,$pubAt,ts(),
  ]);
}

// reel_lga_targets for LGA-specific and grouped reels
$rlt = $db->prepare('INSERT IGNORE INTO reel_lga_targets (reel_id,lga_id) VALUES (?,?)');
$rlt->execute(['reel_001',1]);
$rlt->execute(['reel_003',2]);
$rlt->execute(['reel_005',3]);
$rlt->execute(['reel_007',1]);
$rlt->execute(['reel_008',2]);
$rlt->execute(['reel_009',4]);
$rlt->execute(['reel_012',1]);

// ── Reel likes ────────────────────────────────────────────────────────────
$W('Reel likes…');
$lk = $db->prepare('INSERT IGNORE INTO reel_likes (reel_id,user_id) VALUES (?,?)');
foreach ([
  ['reel_001',100002],['reel_001',100003],['reel_001',100004],
  ['reel_003',100001],['reel_003',100004],
  ['reel_004',100001],['reel_004',100003],['reel_004',100005],
  ['reel_005',100001],
  ['reel_006',100002],['reel_006',100004],
  ['reel_009',100001],['reel_009',100002],['reel_009',100003],
  ['reel_011',100001],['reel_011',100002],['reel_011',100003],['reel_011',100004],['reel_011',100005],
  ['reel_013',100001],['reel_013',100002],['reel_013',100003],
] as [$rid,$uid]) $lk->execute([$rid,$uid]);

// ── Reel comments ─────────────────────────────────────────────────────────
$W('Reel comments…');
$cm = $db->prepare('INSERT INTO reel_comments (reel_id,user_id,user_name,avatar_url,text,created_at)
  VALUES (?,?,?,?,?,?)');
$comments = [
  ['reel_001',100002,'zainab_u',   $citizenAvatars[100002],'Subhanallah! Katsina is so beautiful 🌅',ts(-86400*6+600)],
  ['reel_001',100004,'maryam_s',   $citizenAvatars[100004],'I live here and never get tired of this view ❤️',ts(-86400*5)],
  ['reel_001',100003,'kabiru_i',   $citizenAvatars[100003],'Makes me miss home, I\'m in Funtua 😂',ts(-86400*5+3600)],
  ['reel_003',100001,'abdullahi_m',$citizenAvatars[100001],'Daura is historic wallahi. Every Nigerian should visit 🏰',ts(-86400*4)],
  ['reel_003',100005,'usman_t',    $citizenAvatars[100005],'Beautiful! The Emir\'s palace is incredible',ts(-86400*4+1800)],
  ['reel_004',100001,'abdullahi_m',$citizenAvatars[100001],'Our women are the backbone of this state. Proud! 💪',ts(-86400*1+900)],
  ['reel_004',100003,'kabiru_i',   $citizenAvatars[100003],'My mother is a cotton farmer. She will love this 🌾',ts(-86400*1+2000)],
  ['reel_004',100005,'usman_t',    $citizenAvatars[100005],'Mashallah. Hard work deserves recognition',ts(-86400*1+3000)],
  ['reel_004',100004,'maryam_s',   $citizenAvatars[100004],'This made my day! Shared with my group 🙌',ts(-3600*18)],
  ['reel_009',100001,'abdullahi_m',$citizenAvatars[100001],'800 jobs is massive wallahi. Katsina is moving!',ts(-86400*1+500)],
  ['reel_009',100002,'zainab_u',   $citizenAvatars[100002],'My cousin applied already! Hope they call him 🙏',ts(-86400*1+2500)],
  ['reel_009',100004,'maryam_s',   $citizenAvatars[100004],'This is the best news from Malumfashi in years!',ts(-86400*1+4000)],
  ['reel_011',100002,'zainab_u',   $citizenAvatars[100002],'Thank you KTG Connect team! This app is so useful',ts(-86400*9)],
  ['reel_011',100003,'kabiru_i',   $citizenAvatars[100003],'Keep up the great work. Katsina first!',ts(-86400*9+1000)],
  ['reel_011',100004,'maryam_s',   $citizenAvatars[100004],'Alhamdulillah for progress 🤲',ts(-86400*9+2000)],
  ['reel_011',100005,'usman_t',    $citizenAvatars[100005],'I tell all my people to download this app',ts(-86400*9+3500)],
  ['reel_011',100001,'abdullahi_m',$citizenAvatars[100001],'Proud to be part of this community',ts(-86400*9+5000)],
  ['reel_013',100001,'abdullahi_m',$citizenAvatars[100001],'Happy anniversary! Long may you serve Katsina 🎂',ts(-86400*4)],
  ['reel_013',100002,'zainab_u',   $citizenAvatars[100002],'One year already? Time flies. Best app in the North!',ts(-86400*4+1200)],
  ['reel_013',100003,'kabiru_i',   $citizenAvatars[100003],'🎉🎉🎉 Congratulations KTG Connect team!',ts(-86400*4+2400)],
];
foreach ($comments as $c) $cm->execute($c);

// ── Reel subscriptions ────────────────────────────────────────────────────
$W('Subscriptions…');
$sub = $db->prepare('INSERT IGNORE INTO reel_subscriptions (follower_id,target_id) VALUES (?,?)');
foreach ([
  [100002,100001],[100003,100001],[100004,100001],[100005,100001], // all follow abdullahi
  [100001,100002],[100004,100002],[100005,100002],                  // follow zainab
  [100001,100003],[100002,100003],                                  // follow kabiru
  [100001,100004],[100003,100004],                                  // follow maryam
  [100001,100005],[100002,100005],                                  // follow usman
] as [$f,$t]) $sub->execute([$f,$t]);

// ─────────────────────────────────────────────────────────────────────────────
// 6. CHAT MESSAGES (5 LGA chats)
// ─────────────────────────────────────────────────────────────────────────────
$W('Chat messages…');
$msg = $db->prepare('INSERT INTO lga_chat_messages
  (lga_id,user_id,user_name,avatar_url,text,reactions,created_at)
  VALUES (?,?,?,?,?,?,?)');

function chat(PDO $db, $stmt, int $lgaId, array $msgs): void {
  foreach ($msgs as $m) $stmt->execute([$lgaId, ...$m]);
}

// Avatars shorthand
$av = $citizenAvatars;

// LGA 1 — Katsina (12 messages)
chat($db, $msg, 1, [
  [100001,'abdullahi_m',$av[100001],'Assalamu alaikum Katsina community! 🙏',json_encode(['👋'=>[100004,100002]]),ts(-86400*10)],
  [100004,'maryam_s',$av[100004],'Wa alaikum salam! Great to have this space for our LGA',json_encode(['❤️'=>[100001]]),ts(-86400*10+300)],
  [100001,'abdullahi_m',$av[100001],'Did everyone see the news about the road construction? Tudun Wada is nearly done!',json_encode(['🎉'=>[100004]]),ts(-86400*9)],
  [100004,'maryam_s',$av[100004],'Finally! That road has been a problem for 2 years. Insha\'Allah they finish properly 😅',null,ts(-86400*9+600)],
  [100001,'abdullahi_m',$av[100001],'Anyone registering for the KatsinaTech digital training? I heard top performers get laptops.',json_encode(['🔥'=>[100004]]),ts(-86400*7)],
  [100004,'maryam_s',$av[100004],'Yes I registered yesterday. The venue is at Government Tech Hub. Starts Monday.',null,ts(-86400*7+900)],
  [100001,'abdullahi_m',$av[100001],'@maryam_s good luck! Which track are you doing?',null,ts(-86400*7+1200)],
  [100004,'maryam_s',$av[100004],'Digital marketing. You?',null,ts(-86400*7+1500)],
  [100001,'abdullahi_m',$av[100001],'Web development. Maybe we can study together 😄',json_encode(['😂'=>[100004]]),ts(-86400*7+1800)],
  [100004,'maryam_s',$av[100004],'Haha sure! Just don\'t distract me 😂',json_encode(['😂'=>[100001]]),ts(-86400*7+2100)],
  [100001,'abdullahi_m',$av[100001],'Flood alert from SEMA — please clear your drainage channels before the rains this week.',json_encode(['⚠️'=>[100004]]),ts(-86400*2)],
  [100004,'maryam_s',$av[100004],'Shared in the family group. Everyone be careful please 🙏',null,ts(-86400*2+300)],
]);

// LGA 2 — Daura (10 messages)
chat($db, $msg, 2, [
  [100002,'zainab_u',$av[100002],'Salam Daura community! This platform is mashallah 🌟',json_encode(['👍'=>[100005]]),ts(-86400*8)],
  [100005,'usman_t',$av[100005],'Wa alaikum salam. Great initiative. Reminder: town hall next Friday at Emir\'s Palace grounds.',json_encode(['📢'=>[100002]]),ts(-86400*8+600)],
  [100002,'zainab_u',$av[100002],'Will it be live streamed? Not everyone can attend physically.',null,ts(-86400*8+900)],
  [100005,'usman_t',$av[100005],'Yes! The LGA secretariat confirmed it will be on this platform.',json_encode(['🎉'=>[100002]]),ts(-86400*8+1200)],
  [100002,'zainab_u',$av[100002],'Excellent. The Daura Heritage Festival is coming up too — Oct 10–12. Who is going?',json_encode(['🙋'=>[100005]]),ts(-86400*5)],
  [100005,'usman_t',$av[100005],'I\'m going with my family. The Durbar is the highlight every year 🏇',null,ts(-86400*5+600)],
  [100002,'zainab_u',$av[100002],'The archaeology exhibition is new this year. Very excited to see the ancient finds.',null,ts(-86400*5+1200)],
  [100005,'usman_t',$av[100005],'True history. Daura is the oldest of the Hausa states. We must preserve it.',json_encode(['🤝'=>[100002]]),ts(-86400*5+2000)],
  [100002,'zainab_u',$av[100002],'Good morning Daura 🌅 Anyone know if the new borehole near Yan Gandu ward is working?',null,ts(-86400*2)],
  [100005,'usman_t',$av[100005],'Yes! Tested it yesterday. Clean water alhamdulillah. RUWASSA did a good job this time.',json_encode(['🙏'=>[100002]]),ts(-86400*2+900)],
]);

// LGA 3 — Funtua (8 messages)
chat($db, $msg, 3, [
  [100003,'kabiru_i',$av[100003],'Salam Funtua! Good to have our own community space 🌾',json_encode(['👋'=>[]]),ts(-86400*6)],
  [100003,'kabiru_i',$av[100003],'Agricultural fair registration closes September 30th! Don\'t miss it.',json_encode(['📣'=>[]]),ts(-86400*5)],
  [100003,'kabiru_i',$av[100003],'Cotton prices are good this season. Traders from Kano coming in large numbers.',json_encode(['💰'=>[]]),ts(-86400*4)],
  [100003,'kabiru_i',$av[100003],'New borehole network — 9 boreholes in Funtua. Which wards are getting them? Anyone know?',null,ts(-86400*3)],
  [100003,'kabiru_i',$av[100003],'Found out: Sabon Gari, Kofar Yandaka, Unguwar Rimi, and Karofi wards confirmed.',json_encode(['👍'=>[]]),ts(-86400*3+3600)],
  [100003,'kabiru_i',$av[100003],'KTARDA extension officers arrived in Funtua ward today. Improved groundnut seeds available.',null,ts(-86400*2)],
  [100003,'kabiru_i',$av[100003],'Anyone attended the extension training? Worth it?',null,ts(-86400*1)],
  [100003,'kabiru_i',$av[100003],'Morning Funtua 🌅 Trade fair in 3 weeks. Let\'s make Funtua proud!',json_encode(['🎉'=>[]]),ts(-3600*6)],
]);

// LGA 4 — Malumfashi (8 messages)
chat($db, $msg, 4, [
  [100005,'usman_t',$av[100005],'Salam Malumfashi people! 🎉',json_encode(['👋'=>[]]),ts(-86400*5)],
  [100005,'usman_t',$av[100005],'The textile mill news is massive! 800 jobs — Malumfashi is back!',json_encode(['🔥'=>[]]),ts(-86400*4)],
  [100005,'usman_t',$av[100005],'Do you need to be a Malumfashi indigene to apply? The ad says yes.',null,ts(-86400*4+600)],
  [100005,'usman_t',$av[100005],'Confirmed: you need LGA indigene certificate. Get it from the local government secretariat.',json_encode(['✅'=>[]]),ts(-86400*4+3000)],
  [100005,'usman_t',$av[100005],'Applications close August 31st. Less than 2 weeks left. Move fast!',json_encode(['⚡'=>[]]),ts(-86400*3)],
  [100005,'usman_t',$av[100005],'Water project update: Sabuwa ward borehole commissioned. Solar pump working fine.',json_encode(['💧'=>[]]),ts(-86400*2)],
  [100005,'usman_t',$av[100005],'Malumfashi youth should attend the KatsinaTech training. Free and certificates given.',null,ts(-86400*1)],
  [100005,'usman_t',$av[100005],'Good morning Malumfashi 🌄 Another day to build our community. Let\'s go!',null,ts(-3600*8)],
]);

// LGA 5 — Dutsin-Ma (7 messages)
chat($db, $msg, 5, [
  [100001,'abdullahi_m',$av[100001],'Visiting Dutsin-Ma for the cooperative fair. Beautiful town mashallah.',json_encode(['❤️'=>[]]),ts(-86400*3)],
  [100003,'kabiru_i',$av[100003],'Welcome! FUDMA campus is very impressive. The expansion project will make it even better.',null,ts(-86400*3+600)],
  [100001,'abdullahi_m',$av[100001],'Youth employment programme here is a good initiative. 1,200 apprenticeships!',json_encode(['💪'=>[]]),ts(-86400*3+1800)],
  [100003,'kabiru_i',$av[100003],'Registration is open at the LGA secretariat. Trades include electrical and phone repair.',null,ts(-86400*3+2500)],
  [100001,'abdullahi_m',$av[100001],'Which trade is most in demand here? Asking for a young family member.',null,ts(-86400*2)],
  [100003,'kabiru_i',$av[100003],'Phone repair and tailoring fill up fastest. Electrical is also popular. Apply early.',json_encode(['👍'=>[100001]]),ts(-86400*2+1200)],
  [100001,'abdullahi_m',$av[100001],'Jazakallahu khairan. He will apply for electrical. 🙏',json_encode(['🤲'=>[100003]]),ts(-86400*2+2000)],
]);

// ─────────────────────────────────────────────────────────────────────────────
// 7. NOTIFICATIONS (broad scope — all categories, all users)
// ─────────────────────────────────────────────────────────────────────────────
$W('Notifications…');
$notif = $db->prepare('INSERT INTO notifications
  (user_id,category,priority,title,body,actor_name,actor_avatar_url,link_to,is_read,created_at)
  VALUES (?,?,?,?,?,?,?,?,?,?)');

$notifs = [
  // Official — news alerts (all users)
  [100001,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',null,null,'/news/meningitis-vaccination-statewide',0,ts(-86400*3)],
  [100002,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',null,null,'/news/meningitis-vaccination-statewide',1,ts(-86400*3)],
  [100003,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',null,null,'/news/meningitis-vaccination-statewide',0,ts(-86400*3)],
  [100004,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',null,null,'/news/meningitis-vaccination-statewide',1,ts(-86400*3)],
  [100005,'Official','high','🔴 BREAKING: Meningitis Vaccination Starts Monday','Free vaccination campaign begins across all 34 LGAs. Visit your nearest health post.',null,null,'/news/meningitis-vaccination-statewide',0,ts(-86400*3)],

  // Official — Governor address (headline)
  [100001,'Official','normal','📰 Headline: Governor\'s Q2 Address','₦12 billion infrastructure budget on track. Read the full address.',null,null,'/news/gubernatorial-quarterly-address',0,ts(-86400*1)],
  [100003,'Official','normal','📰 Headline: Governor\'s Q2 Address','₦12 billion infrastructure budget on track. Read the full address.',null,null,'/news/gubernatorial-quarterly-address',0,ts(-86400*1)],
  [100005,'Official','normal','📰 Headline: Governor\'s Q2 Address','₦12 billion infrastructure budget on track. Read the full address.',null,null,'/news/gubernatorial-quarterly-address',0,ts(-86400*1)],

  // Official — LGA-specific news
  [100001,'Official','normal','New Katsina LGA News','14 road projects complete ahead of schedule in Katsina LGA. Roads improved: Tudun Wada, Kofar Kaura, Unguwar Alkali.',null,null,'/news/katsina-road-completion',1,ts(-86400*7)],
  [100004,'Official','normal','New Katsina LGA News','14 road projects complete ahead of schedule in Katsina LGA.',null,null,'/news/katsina-road-completion',0,ts(-86400*7)],
  [100002,'Official','normal','New Daura LGA News','Daura International Heritage Festival returns October 10–12.',null,null,'/news/daura-heritage-festival-2025',0,ts(-86400*3)],
  [100005,'Official','normal','New Malumfashi LGA News','800 jobs at Malumfashi Textile Mill — recruitment begins October.',null,null,'/news/malumfashi-textile-revival',0,ts(-86400*2)],

  // Community — reel likes
  [100001,'Community','normal','zainab_u liked your reel','zainab_u liked your reel: "Sunrise over Katsina city 🌅"','zainab_u',$av[100002],'/reels',1,ts(-86400*6+700)],
  [100001,'Community','normal','kabiru_i liked your reel','kabiru_i liked your reel: "Sunrise over Katsina city 🌅"','kabiru_i',$av[100003],'/reels',1,ts(-86400*6+1400)],
  [100001,'Community','normal','maryam_s liked your reel','maryam_s liked your reel: "Sunrise over Katsina city 🌅"','maryam_s',$av[100004],'/reels',0,ts(-86400*6+2100)],
  [100002,'Community','normal','abdullahi_m liked your reel','abdullahi_m liked your reel: "Daura — the cradle of Hausa civilisation 🏰"','abdullahi_m',$av[100001],'/reels',0,ts(-86400*4+500)],
  [100002,'Community','normal','maryam_s liked your reel','maryam_s liked your reel: "Sisters in agriculture 🌾"','maryam_s',$av[100004],'/reels',0,ts(-86400*1+200)],
  [100003,'Community','normal','abdullahi_m liked your reel','abdullahi_m liked your reel: "Cotton harvest season has arrived 🌿"','abdullahi_m',$av[100001],'/reels',1,ts(-86400*3)],
  [100005,'Community','normal','abdullahi_m liked your reel','abdullahi_m liked your reel: "The old textile mill days are coming back! 🎉"','abdullahi_m',$av[100001],'/reels',0,ts(-86400*1+900)],
  [100005,'Community','normal','zainab_u liked your reel','zainab_u liked your reel: "Malumfashi to the world 🗺️"','zainab_u',$av[100002],'/reels',0,ts(-3600*12)],

  // Community — reel comments
  [100001,'Community','normal','zainab_u commented on your reel','zainab_u: "Subhanallah! Katsina is so beautiful 🌅"','zainab_u',$av[100002],'/reels',1,ts(-86400*6+800)],
  [100001,'Community','normal','kabiru_i commented on your reel','kabiru_i: "Makes me miss home, I\'m in Funtua 😂"','kabiru_i',$av[100003],'/reels',0,ts(-86400*5+3700)],
  [100002,'Community','normal','abdullahi_m commented on your reel','abdullahi_m: "Daura is historic wallahi. Every Nigerian should visit 🏰"','abdullahi_m',$av[100001],'/reels',1,ts(-86400*4+100)],
  [100005,'Community','normal','abdullahi_m commented on your reel','abdullahi_m: "800 jobs is massive wallahi. Katsina is moving!"','abdullahi_m',$av[100001],'/reels',0,ts(-86400*1+600)],

  // Community — new reel from subscribed author
  [100002,'Community','normal','abdullahi_m posted a new reel','abdullahi_m: "Proud to be Katsina! Our governor is working hard 💪"','abdullahi_m',$av[100001],'/reels',0,ts(-86400*3+100)],
  [100003,'Community','normal','abdullahi_m posted a new reel','abdullahi_m: "Proud to be Katsina! Our governor is working hard 💪"','abdullahi_m',$av[100001],'/reels',1,ts(-86400*3+100)],
  [100004,'Community','normal','abdullahi_m posted a new reel','abdullahi_m: "Proud to be Katsina! Our governor is working hard 💪"','abdullahi_m',$av[100001],'/reels',0,ts(-86400*3+100)],
  [100001,'Community','normal','zainab_u posted a new reel','zainab_u: "Sisters in agriculture! 🌾"','zainab_u',$av[100002],'/reels',1,ts(-86400*2+200)],
  [100001,'Community','normal','kabiru_i posted a new reel','kabiru_i: "The youth of Katsina are ready 💯"','kabiru_i',$av[100003],'/reels',0,ts(-86400*1+100)],

  // Security Alert — login notifications
  [100001,'Security Alert','normal','New login to your account','Your account was accessed from a new device in Katsina. If this wasn\'t you, change your password.',null,null,'/settings',1,ts(-86400*5)],
  [100002,'Security Alert','normal','New login to your account','Your account was accessed from a new device in Daura. If this wasn\'t you, change your password.',null,null,'/settings',1,ts(-86400*4)],
  [100003,'Security Alert','normal','New login to your account','New sign-in detected for your KTG Connect account.',null,null,'/settings',0,ts(-86400*3)],

  // Event — community events
  [100001,'Event','normal','Katsina LGA Town Hall — Friday 10am','Monthly community meeting at LGA Secretariat main hall. All residents welcome.',null,null,'/news',0,ts(-86400*2)],
  [100002,'Event','normal','Daura Heritage Festival — Oct 10–12','Official preview and schedule for the Daura International Heritage Festival.',null,null,'/news/daura-heritage-festival-2025',0,ts(-86400*3)],
  [100003,'Event','normal','Funtua Agricultural Fair — Registrations Close Sep 30','Last chance to register as an exhibitor for the 12th Annual Funtua Agric Fair.',null,null,'/news/funtua-agricultural-fair',0,ts(-3600*5)],
  [100005,'Event','normal','Malumfashi Job Fair — September 15','Youth employment briefing for Malumfashi Textile Mill positions. Venue: LGA Secretariat Hall.',null,null,'/news/malumfashi-textile-revival',0,ts(-86400*1)],

  // Community — subscription confirmations
  [100002,'Community','normal','abdullahi_m subscribed to your reels','abdullahi_m will be notified when you post new reels.','abdullahi_m',$av[100001],'/reels',1,ts(-86400*2)],
  [100001,'Community','normal','zainab_u subscribed to your reels','zainab_u will be notified when you post new reels.','zainab_u',$av[100002],'/reels',0,ts(-86400*1)],
  [100003,'Community','normal','abdullahi_m subscribed to your reels','abdullahi_m will be notified when you post new reels.','abdullahi_m',$av[100001],'/reels',0,ts(-86400*3)],
];

foreach ($notifs as $n) $notif->execute($n);

// ─────────────────────────────────────────────────────────────────────────────
// 8. BANNED WORDS
// ─────────────────────────────────────────────────────────────────────────────
$W('Banned words…');
$bw = $db->prepare('INSERT IGNORE INTO banned_words (word) VALUES (?)');
foreach (['testslur','badword1','badword2','spamword'] as $w) $bw->execute([$w]);

// ─────────────────────────────────────────────────────────────────────────────
// 9. PLATFORM SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
$W('Platform settings…');
$ps = $db->prepare('INSERT INTO platform_settings (`key`,`value`) VALUES (?,?)
  ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)');
foreach ([
  ['maintenance_mode','0'],['allow_registrations','1'],
  ['chat_enabled','1'],['reels_enabled','1'],['adverts_enabled','1'],
] as [$k,$v]) $ps->execute([$k,$v]);

// ─────────────────────────────────────────────────────────────────────────────
// Done
// ─────────────────────────────────────────────────────────────────────────────
$W('');
$W('✅  Seed complete.');
$W('');
$W('Counts');
$W('  Admins:        2   (super_admin + admin)');
$W('  Citizens:      5   (Katsina ×2, Daura, Funtua, Malumfashi)');
$W('  News:         22   (4 all-LGA · 6 grouped · 11 LGA-specific · 1 draft)');
$W('  Adverts:      18   (banner ×7 · interstitial ×3 · news ×3 · feed ×3 · paused/expired ×2)');
$W('  Reels:        13   (citizens ×10 · admin ×3)');
$W('  Reel likes:   22');
$W('  Reel comments:20');
$W('  Subscriptions:13');
$W('  Chat msgs:    45   (Katsina·Daura·Funtua·Malumfashi·Dutsin-Ma)');
$W('  Notifications:40+  (Official·Community·Security·Event)');
$W('');
$W('Credentials');
$W('  Super admin   aliyu@admconnect.com    Admin@1234');
$W('  Admin         fatima@admconnect.com   Admin@1234');
$W('  Citizen 1     abdullahi@adm.test      Citizen@1234   Yola North');
$W('  Citizen 2     zainab@adm.test         Citizen@1234   Numan');
$W('  Citizen 3     kabiru@adm.test         Citizen@1234   Mubi North');
$W('  Citizen 4     maryam@adm.test         Citizen@1234   Yola South');
$W('  Citizen 5     usman@adm.test          Citizen@1234   Ganye');
$W('');
$W('⚠  Delete server/seed.php before going to production.');
