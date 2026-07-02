/**
 * ADMConnect — SSE Client
 * ============================================================
 * Manages a single persistent Server-Sent Events connection
 * for the entire app session.
 *
 * Opens one EventSource to GET /events/stream (authenticated via
 * token in the URL since EventSource doesn't support custom headers).
 *
 * Events handled:
 *   connected        — stream opened, confirms userId/lgaId
 *   new_message      — new chat message in the user's LGA
 *   new_notification — a notification was created for this user
 *   ping             — keepalive (ignored, browser handles reconnect)
 *
 * Usage:
 *   import { sseClient } from './sseClient.js';
 *   sseClient.connect();   // call once in WebLayout.afterMount
 *   sseClient.disconnect(); // call on logout
 *
 * The module writes directly to the store so all components
 * (Sidebar badge, Chat page, Notifications page) react automatically.
 *
 * Chat page integration:
 *   Chat.js registers a message handler via sseClient.onMessage()
 *   so new messages appear instantly without polling.
 *   Chat.js removes the handler on unmount so only the chat page
 *   appends messages to the DOM — other pages just update the badge.
 */

import { store, showToast } from '../core/store.js';
import { BASE_URL } from '../api/_fetch.js';
import { api } from '../api/client.js';

class SSEClient {
  constructor() {
    this._es         = null;   // EventSource instance
    this._retryDelay = 3000;   // ms before reconnect attempt
    this._retryTimer = null;
    this._onMessage  = null;   // optional DOM handler (Chat page only)
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Open the SSE stream. Safe to call multiple times — only one
   * connection is kept open at a time.
   */
  async connect() {
    if (this._es) return; // already connected

    const auth = (() => {
      try { return JSON.parse(sessionStorage.getItem('adm_auth')); } catch { return null; }
    })();

    if (!auth?.token) return; // not authenticated

    // Exchange the long-lived JWT for a short-lived SSE token so the
    // main JWT is never exposed in URLs or server access logs.
    const { data, error } = await api.auth.getSseToken();
    if (error || !data?.token) {
      console.warn('[SSE] could not obtain exchange token — retrying in 5s', error?.message);
      this._retryTimer = setTimeout(() => this.connect(), 5000);
      return;
    }

    const url = `${BASE_URL}/events/stream?token=${encodeURIComponent(data.token)}`;

    this._es = new EventSource(url);

    this._es.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      console.debug('[SSE] connected', data);
      this._retryDelay = 3000; // reset backoff on success
    });

    this._es.addEventListener('new_message', (e) => {
      const msg = JSON.parse(e.data);
      const currentUserId = store.currentUser?.id;

      // Always update the sidebar unread badge (unless it's our own message)
      if (msg.userId !== currentUserId) {
        // Only increment if user is NOT on the chat page right now
        const onChatPage = window.location.pathname === '/chat';
        if (!onChatPage) {
          store.unreadChatCount = (store.unreadChatCount || 0) + 1;
        }
      }

      // If a Chat page handler is registered, forward the message to it
      if (this._onMessage) {
        this._onMessage(msg);
      }
    });

    this._es.addEventListener('new_notification', (e) => {
      const notif = JSON.parse(e.data);

      // Increment sidebar badge
      store.unreadNotificationCount = (store.unreadNotificationCount || 0) + 1;

      // Show a toast so the user knows something happened
      // (even if they're not on the notifications page)
      showToast('info', notif.title);
    });

    this._es.addEventListener('ping', () => {
      // Keepalive — nothing to do
    });

    this._es.onerror = () => {
      // EventSource auto-reconnects, but we also do our own backoff
      // in case the token expired or the server restarted
      this._es?.close();
      this._es = null;

      this._retryTimer = setTimeout(() => {
        this._retryDelay = Math.min(this._retryDelay * 2, 30000); // cap at 30s
        this.connect();
      }, this._retryDelay);
    };
  }

  /**
   * Close the SSE connection. Call on logout.
   */
  disconnect() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this._es) {
      this._es.close();
      this._es = null;
    }
    this._onMessage = null;
    console.debug('[SSE] disconnected');
  }

  /**
   * Register a handler to receive new_message events directly.
   * Only one handler is supported at a time — the Chat page.
   * @param {function|null} handler  - receives the message object, or null to remove
   */
  onMessage(handler) {
    this._onMessage = handler;
  }

  /**
   * Whether the SSE connection is currently open.
   * @returns {boolean}
   */
  get connected() {
    return this._es?.readyState === EventSource.OPEN;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const sseClient = new SSEClient();
