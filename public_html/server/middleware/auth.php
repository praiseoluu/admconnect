<?php

/**
 * Auth middleware.
 * Validates the Bearer JWT from the Authorization header.
 * Also accepts token via ?token= query param for SSE endpoints
 * (EventSource API does not support custom headers).
 *
 * lgaId is read FRESH from the DB on every request — not from the JWT.
 * This means LGA changes in Settings take effect immediately.
 */
function requireAuth(): array {
    // Check Authorization header first, then fall back to ?token= query param
    $authHeader = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? (function_exists('apache_request_headers')
            ? (apache_request_headers()['Authorization'] ?? '')
            : '');

    // SSE fallback: token passed as query param
    if (!$authHeader && isset($_GET['token'])) {
        $authHeader = 'Bearer ' . $_GET['token'];
    }

    if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
        Response::error('UNAUTHENTICATED', 'Authorization token required.', 401);
    }

    $token = substr($authHeader, 7);

    // Verify JWT
    try {
        $payload = JWT::decode($token, JWT_SECRET);
    } catch (RuntimeException $e) {
        Response::error('UNAUTHENTICATED', 'Invalid or expired token.', 401);
    }

    // Check blacklist
    $db        = Database::connect();
    $tokenHash = JWT::hash($token);
    $stmt      = $db->prepare('SELECT id FROM jwt_blacklist WHERE token_hash = ?');
    $stmt->execute([$tokenHash]);
    if ($stmt->fetch()) {
        Response::error('UNAUTHENTICATED', 'Token has been revoked.', 401);
    }

    // Update last_seen_at and read fresh lgaId from DB.
    // Reading lgaId from DB (not JWT) means LGA changes in Settings
    // take effect immediately without requiring a logout/login cycle.
    $freshLgaId = isset($payload['lgaId']) ? (int) $payload['lgaId'] : null;
    try {
        $db->prepare('UPDATE users SET last_seen_at = NOW() WHERE id = ?')
           ->execute([$payload['userId']]);
        $sel = $db->prepare('SELECT lga_id FROM users WHERE id = ?');
        $sel->execute([$payload['userId']]);
        $row = $sel->fetch();
        if ($row && isset($row['lga_id'])) {
            $freshLgaId = (int) $row['lga_id'];
        }
    } catch (Exception) {}

    $auth = [
        'userId' => (int) $payload['userId'],
        'role'   => $payload['role'],
        'lgaId'  => $freshLgaId,
        'token'  => $token,
    ];

    $GLOBALS['auth'] = $auth;
    return $auth;
}

/**
 * Require a specific role. Calls requireAuth() first.
 */
function requireRole(string $role): array {
    $auth = requireAuth();
    if ($auth['role'] !== $role) {
        Response::error('FORBIDDEN', 'You do not have permission to perform this action.', 403);
    }
    return $auth;
}