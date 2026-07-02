<?php

/**
 * EmailService — Resend API wrapper.
 *
 * Sends transactional emails via Resend (https://resend.com).
 * All credentials are read from environment variables (set in server/.env).
 *
 * How to obtain credentials (see server/.env.example for step-by-step):
 *   1. Sign in to resend.com → API Keys → Create API Key.
 *   2. Add and verify your domain (admconnect.com) via DNS records.
 *   3. Set RESEND_FROM_EMAIL to a verified sender on that domain.
 */
class EmailService {

    private static function apiKey(): string {
        return getenv('RESEND_API_KEY') ?: '';
    }

    private static function fromAddress(): string {
        $name  = getenv('RESEND_FROM_NAME')  ?: 'ADMConnect';
        $email = getenv('RESEND_FROM_EMAIL') ?: 'hello@adamawakonect.com';
        return "{$name} <{$email}>";
    }

    /**
     * Send an OTP verification email.
     *
     * @param string $toEmail  Recipient email address
     * @param string $toName   Recipient name
     * @param string $otp      The OTP code
     * @param string $type     'verification' | 'identity' (for appropriate subject)
     * @return bool
     */
    public static function sendOtp(string $toEmail, string $toName, string $otp, string $type = 'verification'): bool {
        $subject = $type === 'identity'
            ? 'Your ADMConnect identity verification code'
            : 'Your ADMConnect verification code';

        $html = self::otpTemplate($toName, $otp, $type);

        return self::send($toEmail, $subject, $html);
    }

    /**
     * Send a news alert email to a single recipient.
     *
     * @param string $toEmail
     * @param string $toName
     * @param string $title     News article title
     * @param string $summary   Short summary text
     * @param string $url       Full URL to the article
     * @return bool
     */
    public static function sendNewsAlert(string $toEmail, string $toName, string $title, string $summary, string $url): bool {
        $escapedTitle   = htmlspecialchars($title,   ENT_QUOTES, 'UTF-8');
        $escapedSummary = htmlspecialchars($summary, ENT_QUOTES, 'UTF-8');
        $escapedUrl     = htmlspecialchars($url,     ENT_QUOTES, 'UTF-8');
        $escapedName    = htmlspecialchars($toName,  ENT_QUOTES, 'UTF-8');

        $html = <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f4;font-family:system-ui,sans-serif;">
          <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <div style="background:#1a7a3c;padding:28px 32px;">
              <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">ADMConnect</p>
            </div>
            <div style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#0a1a0d;line-height:1.3;">{$escapedTitle}</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#4a6a4e;line-height:1.6;">{$escapedSummary}</p>
              <a href="{$escapedUrl}" style="display:inline-block;background:#1a7a3c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;">Read Full Article →</a>
              <p style="margin:32px 0 0;font-size:13px;color:#8aaa8e;">Hi {$escapedName}, this alert was sent to you based on your ADMConnect notification preferences. <a href="{$escapedUrl}" style="color:#1a7a3c;">Manage preferences</a></p>
            </div>
          </div>
        </body>
        </html>
        HTML;

        return self::send($toEmail, "New update: {$title}", $html);
    }

    /**
     * Core send method — posts to Resend's /emails endpoint.
     */
    public static function send(string $to, string $subject, string $html, ?string $text = null): bool {
        $key = self::apiKey();
        if (!$key) {
            error_log('[Email] Missing RESEND_API_KEY — email not sent.');
            return false;
        }

        $payload = [
            'from'    => self::fromAddress(),
            'to'      => [$to],
            'subject' => $subject,
            'html'    => $html,
        ];
        if ($text) {
            $payload['text'] = $text;
        }

        $ch = curl_init('https://api.resend.com/emails');
        $caBundle = self::caBundle();
        $sslOpts  = $caBundle
            ? [CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_CAINFO => $caBundle]
            : [CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2];
        curl_setopt_array($ch, $sslOpts + [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $key,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr  = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            error_log("[Email] cURL error: {$curlErr}");
            return false;
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            error_log("[Email] Resend API error {$httpCode}: {$response}");
            return false;
        }

        return true;
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /**
     * Returns the CA bundle path for cURL SSL verification.
     * Priority: CURL_CA_BUNDLE env var → XAMPP Windows path → system paths.
     */
    private static function caBundle(): string {
        // Allow explicit override via environment variable
        $envPath = getenv('CURL_CA_BUNDLE');
        if ($envPath && file_exists($envPath)) {
            return $envPath;
        }

        $candidates = [
            'C:/xampp/php/extras/ssl/cacert.pem',            // XAMPP Windows
            'C:/xampp/apache/bin/cacert.pem',                 // XAMPP alt
            '/etc/ssl/certs/ca-certificates.crt',             // Debian/Ubuntu
            '/etc/pki/tls/certs/ca-bundle.crt',               // RHEL/CentOS
            '/etc/ssl/ca-bundle.pem',                         // openSUSE
            ini_get('curl.cainfo') ?: '',                     // php.ini configured path
        ];

        foreach ($candidates as $path) {
            if ($path && file_exists($path)) {
                return $path;
            }
        }

        // No bundle found — return empty string; cURL will use system defaults
        return '';
    }

    private static function otpTemplate(string $name, string $otp, string $type): string {
        $escapedName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
        $escapedOtp  = htmlspecialchars($otp,  ENT_QUOTES, 'UTF-8');
        $purpose     = $type === 'identity' ? 'verify your identity' : 'verify your account';
        $expiry      = $type === 'identity' ? '10 minutes' : '10 minutes';

        return <<<HTML
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f4f6f4;font-family:system-ui,sans-serif;">
          <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <div style="background:#1a7a3c;padding:28px 32px;">
              <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;">ADMConnect</p>
            </div>
            <div style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:22px;color:#0a1a0d;">Hi {$escapedName},</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#4a6a4e;line-height:1.6;">Use the code below to {$purpose}. This code expires in {$expiry}.</p>
              <div style="background:#f0f7f1;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
                <span style="font-size:36px;font-weight:800;letter-spacing:.18em;color:#1a7a3c;">{$escapedOtp}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#8aaa8e;">If you didn't request this code, you can safely ignore this email. Do not share it with anyone.</p>
            </div>
          </div>
        </body>
        </html>
        HTML;
    }
}
