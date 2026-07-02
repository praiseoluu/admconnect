<?php

/**
 * KTG Connect — Admin Advert Controller
 * ============================================================
 * Endpoints:
 *   GET    /admin/adverts             — paginated list + filters
 *   GET    /admin/adverts/metrics     — stat cards
 *   POST   /admin/adverts/upload      — upload banner to Cloudinary
 *   POST   /admin/adverts             — create advert
 *   GET    /admin/adverts/:id         — single advert
 *   PATCH  /admin/adverts/:id         — update advert
 *   DELETE /admin/adverts/:id         — permanent delete
 *   PATCH  /admin/adverts/:id/pause   — toggle active/paused
 *   POST   /admin/adverts/:id/click   — record a click (citizen side)
 */
class AdminAdvertController {
    private PDO $db;

    public function __construct() {
        $this->db = Database::connect();
    }

    // ── GET /admin/adverts ────────────────────────────────────────────────

    public function list(): void {
        $this->requireAdmin();
        $p      = Paginator::params($_GET, 10);
        $tab       = trim($_GET['tab']       ?? 'all');
        $search    = trim($_GET['search']    ?? '');
        $placement = trim($_GET['placement'] ?? '');

        $where  = ['1=1'];
        $params = [];

        if ($tab === 'active')    { $where[] = 'a.status = "active"'; }
        elseif ($tab === 'paused')  { $where[] = 'a.status = "paused"'; }
        elseif ($tab === 'expired') { $where[] = 'a.status = "expired"'; }

        if ($search) {
            $where[]  = '(a.title LIKE ? OR a.advertiser LIKE ?)';
            $like     = "%{$search}%";
            $params[] = $like;
            $params[] = $like;
        }

        if ($placement) {
            $where[]  = 'a.type = ?';
            $params[] = $placement;
        }

        $whereStr  = implode(' AND ', $where);
        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM adverts a WHERE {$whereStr}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $stmt = $this->db->prepare("
            SELECT a.*
            FROM adverts a
            WHERE {$whereStr}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([...$params, $p['limit'], $p['offset']]);
        $items = array_map([$this, 'format'], $stmt->fetchAll());

        Response::paginated($items, $p['page'], $p['perPage'], $total);
    }

    // ── GET /admin/adverts/metrics ────────────────────────────────────────

    public function metrics(): void {
        $this->requireAdmin();

        $active = (int) $this->db->query(
            'SELECT COUNT(*) FROM adverts WHERE status = "active"'
        )->fetchColumn();

        $awaitingReview = (int) $this->db->query(
            'SELECT COUNT(*) FROM adverts WHERE status = "active" AND start_date > CURDATE()'
        )->fetchColumn();

        // Reach MTD = total impressions this month
        $reachMTD = (int) $this->db->query(
            'SELECT COALESCE(SUM(impressions), 0) FROM adverts'
        )->fetchColumn();

        // Campaign ROI = total clicks / total impressions (as ratio)
        $totalImpressions = (int) $this->db->query(
            'SELECT COALESCE(SUM(impressions), 0) FROM adverts WHERE status = "active"'
        )->fetchColumn();
        $totalClicks = (int) $this->db->query(
            'SELECT COALESCE(SUM(clicks), 0) FROM adverts WHERE status = "active"'
        )->fetchColumn();
        $roi = $totalImpressions > 0
            ? round($totalClicks / $totalImpressions * 100, 1)
            : 0;

        Response::json([
            'activeCampaigns' => $active,
            'awaitingReview'  => $awaitingReview,
            'reachMTD'        => $reachMTD,
            'campaignROI'     => $roi,
        ]);
    }

    // ── POST /admin/adverts/upload ────────────────────────────────────────

    public function uploadBanner(): void {
        $this->requireAdmin();

        if (empty($_FILES['image'])) {
            Response::error('VALIDATION_ERROR', 'No file uploaded. Use multipart/form-data with field "image".', 422);
        }

        $file = $_FILES['image'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error('UPLOAD_ERROR', 'File upload failed.', 422);
        }

        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        $mime = mime_content_type($file['tmp_name']);
        if (!in_array($mime, $allowedMimes, true)) {
            Response::error('VALIDATION_ERROR', 'Only JPEG, PNG or WebP images are allowed.', 422);
        }

        if ($file['size'] > 5 * 1024 * 1024) {
            Response::error('VALIDATION_ERROR', 'Image must not exceed 5MB.', 422);
        }

        try {
            $mime = mime_content_type($file['tmp_name']);
            $ext  = S3::mimeToExt($mime);
            $key  = S3::makeKey('promos', $ext);
            $url  = S3::upload($file['tmp_name'], $key, $mime);
            Response::json(['url' => $url, 'publicId' => $key, 'width' => 0, 'height' => 0]);
        } catch (RuntimeException $e) {
            Response::error('UPLOAD_ERROR', $e->getMessage(), 500);
        }
    }

    // ── POST /admin/adverts ───────────────────────────────────────────────

    public function create(): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];
        $this->validateBody($body);

        $targetAll = (bool) ($body['targetAllLgas'] ?? true);
        $lgaIds    = $body['lgaIds'] ?? [];

        $stmt = $this->db->prepare('
            INSERT INTO adverts (
                title, advertiser, description, internal_note,
                cta_label, cta_url,
                image_url, cloudinary_id,
                type, status,
                target_all_lgas,
                start_date, end_date,
                impressions, clicks,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?,
                ?, ?,
                ?, ?,
                ?,
                ?, ?,
                0, 0,
                NOW(), NOW()
            )
        ');

        $stmt->execute([
            trim($body['title']),
            trim($body['advertiser']     ?? ''),
            trim($body['description']    ?? '') ?: null,
            trim($body['internalNote']   ?? '') ?: null,
            trim($body['ctaLabel']       ?? '') ?: null,
            trim($body['ctaUrl']         ?? '') ?: null,
            $body['imageUrl']            ?? null,
            $body['cloudinaryId']        ?? null,
            $body['type']                ?? 'banner',
            $body['status']              ?? 'active',
            $targetAll ? 1 : 0,
            $body['startDate']           ?? null,
            $body['endDate']             ?? null,
        ]);

        $id = (int) $this->db->lastInsertId();

        if (!$targetAll && !empty($lgaIds)) {
            $this->syncLgaTargets($id, $lgaIds);
        }

        Response::json($this->format($this->fetchFull($id)), 201);
    }

    // ── GET /admin/adverts/:id ────────────────────────────────────────────

    public function getById(int $id): void {
        $this->requireAdmin();
        $advert = $this->fetchFull($id);
        if (!$advert) Response::error('NOT_FOUND', 'Advert not found.', 404);
        Response::json($this->format($advert));
    }

    // ── PATCH /admin/adverts/:id ──────────────────────────────────────────

    public function update(int $id): void {
        $this->requireAdmin();
        $body = Validator::jsonBody() ?? [];

        $stmt = $this->db->prepare('SELECT id FROM adverts WHERE id = ?');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) Response::error('NOT_FOUND', 'Advert not found.', 404);

        $fields = [];
        $values = [];

        $stringFields = [
            'title'        => 'title',
            'advertiser'   => 'advertiser',
            'description'  => 'description',
            'internalNote' => 'internal_note',
            'ctaLabel'     => 'cta_label',
            'ctaUrl'       => 'cta_url',
            'imageUrl'     => 'image_url',
            'cloudinaryId' => 'cloudinary_id',
            'type'         => 'type',
            'status'       => 'status',
            'startDate'    => 'start_date',
            'endDate'      => 'end_date',
        ];

        foreach ($stringFields as $key => $col) {
            if (array_key_exists($key, $body)) {
                $fields[] = "{$col} = ?";
                $values[] = $body[$key] !== null ? trim((string) $body[$key]) : null;
            }
        }

        if (array_key_exists('targetAllLgas', $body)) {
            $fields[] = 'target_all_lgas = ?';
            $values[] = $body['targetAllLgas'] ? 1 : 0;
        }

        if (!empty($fields)) {
            $fields[]  = 'updated_at = NOW()';
            $values[]  = $id;
            $this->db->prepare('UPDATE adverts SET ' . implode(', ', $fields) . ' WHERE id = ?')
                ->execute($values);
        }

        if (array_key_exists('lgaIds', $body)) {
            $this->db->prepare('DELETE FROM advert_lga_targets WHERE advert_id = ?')->execute([$id]);
            if (!empty($body['lgaIds'])) $this->syncLgaTargets($id, $body['lgaIds']);
        }

        Response::json($this->format($this->fetchFull($id)));
    }

    // ── DELETE /admin/adverts/:id ─────────────────────────────────────────

    public function delete(int $id): void {
        $this->requireAdmin();

        $stmt = $this->db->prepare('SELECT cloudinary_id FROM adverts WHERE id = ?');
        $stmt->execute([$id]);
        $advert = $stmt->fetch();
        if (!$advert) Response::error('NOT_FOUND', 'Advert not found.', 404);

        if ($advert['cloudinary_id']) {
            try { S3::delete($advert['cloudinary_id']); } catch (RuntimeException) {}
        }

        $this->db->prepare('DELETE FROM advert_lga_targets WHERE advert_id = ?')->execute([$id]);
        $this->db->prepare('DELETE FROM adverts WHERE id = ?')->execute([$id]);
        Response::json(['deleted' => true]);
    }

    // ── PATCH /admin/adverts/:id/pause ────────────────────────────────────

    public function togglePause(int $id): void {
        $this->requireAdmin();

        $stmt = $this->db->prepare('SELECT status FROM adverts WHERE id = ?');
        $stmt->execute([$id]);
        $advert = $stmt->fetch();
        if (!$advert) Response::error('NOT_FOUND', 'Advert not found.', 404);

        $newStatus = $advert['status'] === 'paused' ? 'active' : 'paused';
        $this->db->prepare('UPDATE adverts SET status = ?, updated_at = NOW() WHERE id = ?')
            ->execute([$newStatus, $id]);

        Response::json(['id' => $id, 'status' => $newStatus]);
    }

    // ── POST /admin/adverts/:id/click (citizen-facing) ────────────────────

    public function recordClick(int $id): void {
        requireAuth(); // Require citizen authentication — prevent anonymous click inflation
        $this->db->prepare('UPDATE adverts SET clicks = clicks + 1 WHERE id = ?')
            ->execute([$id]);
        Response::json(['recorded' => true]);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private function requireAdmin(): array {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? (function_exists('apache_request_headers')
                ? (apache_request_headers()['Authorization'] ?? '')
                : '');

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            Response::error('UNAUTHENTICATED', 'Authorization token required.', 401);
        }
        $token = substr($authHeader, 7);
        try {
            $payload = JWT::decode($token, JWT_SECRET);
        } catch (RuntimeException) {
            Response::error('UNAUTHENTICATED', 'Invalid or expired token.', 401);
        }
        if (($payload['type'] ?? '') !== 'admin') {
            Response::error('FORBIDDEN', 'Admin access required.', 403);
        }

        $role = $payload['role'] ?? '';
        if (!in_array($role, ['super_admin', 'admin'], true)) {
            http_response_code(403);
            echo json_encode(['error' => ['code' => 'FORBIDDEN', 'message' => 'Insufficient privileges.']]);
            exit;
        }

        // Check blacklist
        $blStmt = $this->db->prepare(
            "SELECT 1 FROM jwt_blacklist WHERE token_hash = ? AND expires_at > NOW() LIMIT 1"
        );
        $blStmt->execute([hash('sha256', $token)]);
        if ($blStmt->fetchColumn()) {
            http_response_code(401);
            echo json_encode(['error' => ['code' => 'TOKEN_REVOKED', 'message' => 'Token has been revoked.']]);
            exit;
        }

        return $payload;
    }

    private function validateBody(array $body): void {
        if (empty($body['title'])) {
            Response::error('VALIDATION_ERROR', 'Title (caption name) is required.', 422);
        }
    }

    private function fetchFull(int $id): ?array {
        $stmt = $this->db->prepare('SELECT * FROM adverts WHERE id = ?');
        $stmt->execute([$id]);
        $advert = $stmt->fetch();
        if (!$advert) return null;

        $lgaStmt = $this->db->prepare('
            SELECT l.id, l.name FROM advert_lga_targets alt
            JOIN lgas l ON l.id = alt.lga_id WHERE alt.advert_id = ?
        ');
        $lgaStmt->execute([$id]);
        $advert['lga_targets'] = $lgaStmt->fetchAll();
        return $advert;
    }

    private function syncLgaTargets(int $advertId, array $lgaIds): void {
        $stmt = $this->db->prepare(
            'INSERT IGNORE INTO advert_lga_targets (advert_id, lga_id) VALUES (?, ?)'
        );
        foreach ($lgaIds as $lgaId) {
            $stmt->execute([$advertId, (int) $lgaId]);
        }
    }

    private function format(array $a): array {
        $lgaTargets = array_map(fn($l) => [
            'id'   => (int) $l['id'],
            'name' => $l['name'],
        ], $a['lga_targets'] ?? []);

        // Compute duration in days
        $durationDays = null;
        if ($a['start_date'] && $a['end_date']) {
            $start = new DateTime($a['start_date']);
            $end   = new DateTime($a['end_date']);
            $durationDays = (int) $start->diff($end)->days;
        }

        // Computed display ID: AD-YYYY-NNN
        $year      = date('Y', strtotime($a['created_at']));
        $displayId = 'AD-' . $year . '-' . str_pad($a['id'], 3, '0', STR_PAD_LEFT);

        return [
            'id'            => (int) $a['id'],
            'displayId'     => $displayId,
            'title'         => $a['title'],
            'advertiser'    => $a['advertiser'],
            'description'   => $a['description'],
            'internalNote'  => $a['internal_note'],
            'ctaLabel'      => $a['cta_label'],
            'ctaUrl'        => $a['cta_url'],
            'imageUrl'      => $a['image_url'],
            'cloudinaryId'  => $a['cloudinary_id'],
            'type'          => $a['type'],
            'status'        => $a['status'],
            'targetAllLgas' => (bool) $a['target_all_lgas'],
            'lgaTargets'    => $lgaTargets,
            'startDate'     => $a['start_date'],
            'endDate'       => $a['end_date'],
            'durationDays'  => $durationDays,
            'impressions'   => (int) $a['impressions'],
            'clicks'        => (int) $a['clicks'],
            'ctr'           => $a['impressions'] > 0
                ? round($a['clicks'] / $a['impressions'] * 100, 2)
                : 0,
            'createdAt'     => $a['created_at'],
            'updatedAt'     => $a['updated_at'],
        ];
    }
}
