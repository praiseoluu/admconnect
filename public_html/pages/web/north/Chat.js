/**
 * KTG Connect — Community Chat Page
 * Route: /chat
 * Guards: requireAuth + requireCitizen
 * ============================================================
 * Real-time messages via SSE (sseClient).
 * Falls back gracefully if SSE is not connected.
 * Unread separator + mark-as-read on open.
 * All original features preserved.
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js';
import { Avatar } from '../../../components/base/UI.js';
import { store, showToast, setPageLoading } from '../../../core/store.js';
import { api } from '../../../api/client.js';
import { sseClient } from '../../../core/sseClient.js';
import { t } from '../../../core/i18n.js';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const EMOJI_GRID = [
  '😀', '😂', '😍', '😎', '😭', '😡', '👍', '👎', '❤️', '🔥',
  '🎉', '💯', '🙏', '👏', '🤔', '😅', '😊', '🥺', '😱', '🤣',
  '💪', '🫡', '🫶', '🤝', '👀', '🗣️', '📢', '🌿', '🌟', '⚡',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function _relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function isToday(iso) {
  const d = new Date(iso);
  const n = new Date();
  return d.toDateString() === n.toDateString();
}

// ──────────────────────────────────────────────────────────────────────────

export default class ChatPage extends WebLayout {
  static styles = '/pages/web/app/Chat.css';

  constructor(props) {
    super({ title: t('chat.title'), ...props });
    this._messages = [];
    this._replyTo = null;
    this._searchActive = false;
    this._searchQuery = '';
    this._searchMatches = [];
    this._searchIdx = 0;
    this._contextTarget = null;
    this._emojiPanelOpen = false;
    this._sending = false;
    this._lastRenderedDate = null;
    this._objectURLs = new Set();
    this._lastReadId = 0;
    this._unreadSeparatorId = null;
    this._reportMsgId = null;
    this._reportReason = null;
    this._activeLgaId = store.currentUser?.lgaId ?? null;
    this._allPreviews = [];
  }

  getContent() {
    const lgaName = store.currentLGA?.name || 'your LGA';
    return `
      <div class="chat-shell" id="chat-shell">

        <!-- ── Left sidebar: LGA community list ── -->
        <aside class="chat-list-sidebar" id="chat-list-sidebar" aria-label="LGA Communities">
          <div class="chat-list-sidebar__header">
            <span class="chat-list-sidebar__title">Communities</span>
          </div>
          <div class="chat-list-sidebar__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" class="chat-list-sidebar__search-input" id="lga-search-input" placeholder="Search…" autocomplete="off" aria-label="Search communities" />
          </div>
          <div class="chat-list-sidebar__unread-label" id="unread-label">Unread Messages <span class="chat-list-sidebar__unread-badge" id="unread-badge" aria-hidden="true"></span></div>
          <nav class="chat-list-sidebar__list" id="lga-list" aria-label="LGA list">
            ${[1,2,3,4,5].map(() => `
              <div class="chat-list-item chat-list-item--skeleton">
                <div class="chat-list-item__avatar skeleton-pulse"></div>
                <div class="chat-list-item__body">
                  <div class="chat-list-item__skel-name skeleton-pulse"></div>
                  <div class="chat-list-item__skel-preview skeleton-pulse"></div>
                </div>
              </div>
            `).join('')}
          </nav>
        </aside>

        <!-- ── Centre: existing chat panel ── -->
        <div class="chat-page" id="chat-page">

          <div class="chat-header" id="chat-header">
            <div class="chat-header__left">
              <div class="chat-header__avatar" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div class="chat-header__info">
                <h1 class="chat-header__name">${this.esc(lgaName)} Community</h1>
                <p class="chat-header__members" id="online-count">
                  <span class="chat-header__online-dot" aria-hidden="true"></span>
                  Loading members…
                </p>
            </div>
          </div>
          <div class="chat-header__actions">
            <button class="chat-header__icon-btn" id="search-toggle-btn" type="button" aria-label="Search messages">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
            <button class="chat-header__icon-btn" id="kebab-btn" type="button" aria-label="More options" aria-haspopup="menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <button class="chat-header__invite-btn" id="invite-btn" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              <span>Invite</span>
            </button>
          </div>
        </div>

        <div class="chat-search-bar" id="chat-search-bar" aria-hidden="true">
          <input type="text" class="chat-search-bar__input" id="search-input" placeholder="Search messages…" autocomplete="off" aria-label="Search messages" />
          <span class="chat-search-bar__nav" id="search-nav" aria-live="polite"></span>
          <button class="chat-search-bar__arrow" id="search-prev" type="button" aria-label="Previous result" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="chat-search-bar__arrow" id="search-next" type="button" aria-label="Next result" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="chat-search-bar__close" id="search-close" type="button" aria-label="Close search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="chat-body" id="chat-body" role="log" aria-live="polite" aria-label="Chat messages">
          <div class="chat-body__skeleton" id="chat-skeleton" aria-hidden="true">
            ${[1, 2, 3, 4, 5].map((i) => `
              <div class="chat-skeleton-row ${i % 3 === 0 ? 'chat-skeleton-row--right' : ''}">
                ${i % 3 !== 0 ? '<div class="chat-skeleton-avatar skeleton-pulse"></div>' : ''}
                <div class="chat-skeleton-bubble skeleton-pulse ${i % 3 === 0 ? 'chat-skeleton-bubble--right' : ''}"></div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="chat-reply-bar" id="chat-reply-bar" aria-hidden="true">
          <div class="chat-reply-bar__content" id="reply-bar-content"></div>
          <button class="chat-reply-bar__close" id="reply-bar-close" type="button" aria-label="Cancel reply">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="chat-input-bar" id="chat-input-bar">
          <button class="chat-input-bar__icon-btn" id="attach-btn" type="button" aria-label="Attach file">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </button>
          <input type="file" id="file-input" class="chat-input-bar__file-input" aria-hidden="true" tabindex="-1" />
          <div class="chat-input-bar__input-wrap">
            <textarea class="chat-input-bar__textarea" id="chat-textarea"
              placeholder="Message ${this.esc(lgaName)} Community…"
              rows="1" aria-label="Type a message" autocomplete="off"></textarea>
          </div>
          <button class="chat-input-bar__icon-btn" id="emoji-btn" type="button" aria-label="Emoji" aria-haspopup="true" aria-expanded="false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button class="chat-input-bar__send-btn" id="send-btn" type="button" aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <p class="chat-input-hint">ENTER TO SEND &nbsp;·&nbsp; SHIFT + ENTER FOR NEW LINE</p>

        <div class="chat-context-menu" id="chat-context-menu" role="menu" inert>
          <div class="chat-context-menu__reactions" id="context-reactions">
            ${DEFAULT_REACTIONS.map(e => `<button class="chat-context-menu__emoji" data-emoji="${e}" type="button" aria-label="React with ${e}">${e}</button>`).join('')}
            <button class="chat-context-menu__emoji chat-context-menu__emoji--more" id="context-emoji-more" type="button" aria-label="More reactions" aria-expanded="false">+</button>
          </div>
          <div class="chat-context-menu__emoji-grid" id="context-emoji-grid" inert>
            ${EMOJI_GRID.map(e => `<button class="chat-context-menu__emoji chat-context-menu__emoji--grid" data-emoji="${e}" type="button" aria-label="${e}">${e}</button>`).join('')}
          </div>
          <div class="chat-context-menu__divider"></div>
          <button class="chat-context-menu__item" data-action="copy" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copy
          </button>
          <button class="chat-context-menu__item" data-action="reply" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
            Reply
          </button>
          <div class="chat-context-menu__divider"></div>
          <button class="chat-context-menu__item chat-context-menu__item--danger" data-action="report" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Report
          </button>
        </div>

        <div class="chat-emoji-panel" id="chat-emoji-panel" aria-hidden="true">
          <div class="chat-emoji-panel__grid">
            ${EMOJI_GRID.map(e => `<button class="chat-emoji-panel__item" data-emoji="${e}" type="button" aria-label="${e}">${e}</button>`).join('')}
          </div>
        </div>

        <div class="chat-kebab-menu" id="chat-kebab-menu" role="menu" aria-hidden="true">
          <button class="chat-kebab-menu__item" data-kebab="mute" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            Mute notifications
          </button>
          <button class="chat-kebab-menu__item" data-kebab="members" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            View members
          </button>
          <button class="chat-kebab-menu__item" data-kebab="clear" type="button" role="menuitem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Clear chat
          </button>
        </div>

        <div class="chat-modal-backdrop" id="invite-backdrop" aria-hidden="true">
          <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
            <div class="chat-modal__header">
              <h2 class="chat-modal__title" id="invite-modal-title">Invite to Community</h2>
              <button class="chat-modal__close" id="invite-close" type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p class="chat-modal__desc">Enter the phone number of the person you'd like to invite to the ${this.esc(lgaName)} Community chat.</p>
            <input type="tel" class="chat-modal__input" id="invite-phone" placeholder="+234 801 234 5678" autocomplete="tel" />
            <p class="chat-modal__error" id="invite-error"></p>
            <div class="chat-modal__actions">
              <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="invite-cancel" type="button">Cancel</button>
              <button class="ktg-btn ktg-btn--primary ktg-btn--md" id="invite-send" type="button">Send Invite</button>
            </div>
          </div>
        </div>

        <div class="chat-modal-backdrop" id="report-backdrop" aria-hidden="true">
          <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
            <div class="chat-modal__header">
              <h2 class="chat-modal__title" id="report-modal-title">Report Message</h2>
              <button class="chat-modal__close" id="report-close" type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p class="chat-modal__desc">Why are you reporting this message?</p>
            <div class="chat-report-reasons" id="report-reasons">
              ${['Spam', 'Harassment', 'Misinformation', 'Inappropriate content', 'Other'].map(r =>
        `<button class="chat-report-reason" data-reason="${r}" type="button">${r}</button>`
    ).join('')}
            </div>
            <p class="chat-modal__error" id="report-error"></p>
            <div class="chat-modal__actions">
              <button class="ktg-btn ktg-btn--ghost ktg-btn--md" id="report-cancel" type="button">Cancel</button>
              <button class="ktg-btn ktg-btn--danger ktg-btn--md" id="report-submit" type="button" disabled>Submit Report</button>
            </div>
          </div>
        </div>

        <div class="chat-modal-backdrop" id="members-backdrop" aria-hidden="true">
          <div class="chat-modal" role="dialog" aria-modal="true" aria-labelledby="members-modal-title">
            <div class="chat-modal__header">
              <h2 class="chat-modal__title" id="members-modal-title">Community Members</h2>
              <button class="chat-modal__close" id="members-close" type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="chat-modal__members-list" id="members-list">
              <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>
            </div>
          </div>
        </div>

        </div> <!-- end .chat-page -->

        <!-- ── Right sidebar: ads ── -->
        <aside class="chat-ads-sidebar" id="chat-ads-sidebar" aria-label="Advertisements">
          <div id="chat-ads-mount"></div>
        </aside>

      </div> <!-- end .chat-shell -->
    `;
  }

  async onContentReady() {
    setPageLoading(true);
    await Promise.all([
      this._loadMessages(),
      this._loadPreviews(),
      this._loadSidebarAds(),
    ]);
    this._loadOnlineCount();
    this._bindEvents();
    this._bindLgaSearch();
    this._connectSSE();
    this._updateChatHeader();
    setPageLoading(false);
  }

  // ── LGA sidebar ───────────────────────────────────────────────────────

  async _loadPreviews() {
    const res = await api.chat.getPreviews();
    if (res.error) {
      // Fall back to plain LGA list if previews endpoint fails
      const lgaRes = await api.lgas.getAll();
      this._allPreviews = (lgaRes.data || []).map((l) => ({ ...l, lastMessage: null, unreadCount: 0 }));
    } else {
      this._allPreviews = res.data || [];
    }
    this._renderLgaList(this._allPreviews);
  }

  _renderLgaList(previews) {
    const el = this.getContentEl();
    const list = el?.querySelector('#lga-list');
    const badge = el?.querySelector('#unread-badge');
    if (!list) return;

    const totalUnread = previews.reduce((sum, p) => sum + (p.unreadCount || 0), 0);
    if (badge) {
      badge.textContent = totalUnread > 0 ? totalUnread : '';
      badge.style.display = totalUnread > 0 ? '' : 'none';
    }

    if (!previews.length) {
      list.innerHTML = `<p class="chat-list-sidebar__empty">No communities found.</p>`;
      return;
    }

    list.innerHTML = previews.map((lga) => {
      const isActive = lga.id === this._activeLgaId;
      const initials = lga.name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
      const last = lga.lastMessage;
      let previewText = '';
      let timeText = '';
      if (last) {
        const prefix = last.isMe ? 'You' : last.sender;
        previewText = `${prefix}: ${last.text || 'Sent a file'}`;
        timeText = _relativeTime(last.createdAt);
      }
      const unread = lga.unreadCount || 0;
      return `
        <button class="chat-list-item${isActive ? ' chat-list-item--active' : ''}"
          data-lga-id="${lga.id}" data-lga-name="${this.esc(lga.name)}" type="button" role="listitem">
          <div class="chat-list-item__avatar" aria-hidden="true">${initials}</div>
          <div class="chat-list-item__body">
            <span class="chat-list-item__name">${this.esc(lga.name)} LGA</span>
            <span class="chat-list-item__preview">${this.esc(previewText)}</span>
          </div>
          <div class="chat-list-item__meta">
            ${timeText ? `<span class="chat-list-item__time">${this.esc(timeText)}</span>` : ''}
            ${unread > 0 ? `<span class="chat-list-item__unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
          </div>
        </button>
      `;
    }).join('');

    list.querySelectorAll('.chat-list-item[data-lga-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.lgaId, 10);
        if (id === this._activeLgaId) return;
        this._switchLga(id, btn.dataset.lgaName);
      });
    });
  }

  _switchLga(lgaId, lgaName) {
    this._activeLgaId = lgaId;
    this._messages = [];
    this._lastRenderedDate = null;
    this._unreadSeparatorId = null;
    this._replyTo = null;
    this._clearReply();
    // Re-render sidebar to update active state
    const q = this.getContentEl()?.querySelector('#lga-search-input')?.value.trim().toLowerCase() || '';
    const filtered = q ? this._allPreviews.filter((l) => l.name.toLowerCase().includes(q)) : this._allPreviews;
    this._renderLgaList(filtered);
    this._updateChatHeader(lgaName);
    // Update textarea placeholder
    const textarea = this.getContentEl()?.querySelector('#chat-textarea');
    if (textarea) textarea.placeholder = `Message ${lgaName} Community…`;
    this._loadMessages();
    this._loadOnlineCount();
  }

  _updateChatHeader(lgaName) {
    const name = lgaName || this._allPreviews.find((p) => p.id === this._activeLgaId)?.name || store.currentLGA?.name || 'Community';
    const header = this.getContentEl()?.querySelector('.chat-header__name');
    if (header) header.textContent = `${name} Community`;
  }

  _bindLgaSearch() {
    const input = this.getContentEl()?.querySelector('#lga-search-input');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      const filtered = q
          ? this._allPreviews.filter((l) => l.name.toLowerCase().includes(q))
          : this._allPreviews;
      this._renderLgaList(filtered);
    });
  }

  // ── Ad sidebar ────────────────────────────────────────────────────────

  async _loadSidebarAds() {
    const res = await api.adverts.getForLGA('banner');
    const ads = (!res.error && res.data?.length) ? res.data.slice(0, 5) : [];
    const mount = this.getContentEl()?.querySelector('#chat-ads-mount');
    if (!mount) return;

    const placeholder = `
      <div class="chat-ad-card chat-ad-card--placeholder" aria-hidden="true">
        <div class="chat-ad-card__img-placeholder skeleton-pulse"></div>
        <div class="chat-ad-card__body">
          <div class="chat-ad-card__skel-label skeleton-pulse"></div>
          <div class="chat-ad-card__skel-title skeleton-pulse"></div>
        </div>
      </div>`;

    const adCards = ads.map((ad) => `
      <a class="chat-ad-card${ad.imageUrl ? '' : ' chat-ad-card--no-img'}"
        href="${this.esc(ad.ctaUrl || '#')}" target="_blank" rel="noopener noreferrer"
        data-ad-id="${ad.id}" aria-label="Sponsored: ${this.esc(ad.title)}">
        ${ad.imageUrl
        ? `<img class="chat-ad-card__img" src="${this.esc(ad.imageUrl)}" alt="${this.esc(ad.title)}" loading="lazy" />`
        : `<div class="chat-ad-card__img-placeholder" aria-hidden="true">
               <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".4"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
             </div>`}
        <div class="chat-ad-card__body">
          <span class="chat-ad-card__label">Sponsored</span>
          ${ad.advertiser ? `<span class="chat-ad-card__advertiser">${this.esc(ad.advertiser)}</span>` : ''}
          <p class="chat-ad-card__title">${this.esc(ad.title)}</p>
          ${ad.ctaLabel ? `<span class="chat-ad-card__cta">${this.esc(ad.ctaLabel)}</span>` : ''}
        </div>
      </a>`);

    const items = [
      ...adCards,
      ...Array.from({ length: Math.max(0, 3 - ads.length) }, () => placeholder),
    ].join('');

    mount.innerHTML = `<div class="chat-ads-stack">${items}</div>`;

    mount.addEventListener('click', (e) => {
      const el = e.target.closest('[data-ad-id]');
      if (el) api.adverts.recordClick(parseInt(el.dataset.adId, 10));
    });
  }

  // ── SSE integration ───────────────────────────────────────────────────

  _connectSSE() {
    // Register this page as the recipient of new_message SSE events.
    // When a new message arrives from the server, append it directly
    // to the DOM — no polling needed.
    sseClient.onMessage((msg) => {
      if (msg.userId === store.currentUser?.id) return;
      if (this._messages.some((m) => m.id === msg.id)) return;

      // Update sidebar preview regardless of which LGA the message is for
      const preview = this._allPreviews.find((p) => p.id === msg.lgaId);
      if (preview) {
        preview.lastMessage = {
          text: msg.text || msg.fileName || '',
          sender: msg.userName,
          isMe: false,
          createdAt: msg.createdAt,
        };
        if (msg.lgaId !== this._activeLgaId) {
          preview.unreadCount = (preview.unreadCount || 0) + 1;
        }
        const q = this.getContentEl()?.querySelector('#lga-search-input')?.value.trim().toLowerCase() || '';
        const filtered = q ? this._allPreviews.filter((l) => l.name.toLowerCase().includes(q)) : this._allPreviews;
        this._renderLgaList(filtered);
      }

      // Only append to message list if it belongs to the active LGA
      if (msg.lgaId !== this._activeLgaId) return;

      this._messages.push(msg);
      this._appendMessage(msg);

      api.chat.markRead({ lgaId: this._activeLgaId });
      store.unreadChatCount = 0;
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────

  async _loadMessages() {
    const lgaId = this._activeLgaId;
    const unreadRes = await api.chat.getUnreadCount({ lgaId });
    this._lastReadId = unreadRes.data?.lastReadId ?? 0;
    const unreadCount = unreadRes.data?.count ?? 0;

    const res = await api.chat.getMessages({ lgaId, perPage: 100 });
    const skeleton = this.getContentEl()?.querySelector('#chat-skeleton');
    skeleton?.remove();
    if (res.error) return;

    this._messages = res.data || [];

    const userId = store.currentUser?.id;
    if (unreadCount > 0 && this._lastReadId > 0) {
      const firstUnread = this._messages.find(
          (m) => m.id > this._lastReadId && m.userId !== userId
      );
      this._unreadSeparatorId = firstUnread?.id ?? null;
    } else if (unreadCount > 0 && this._lastReadId === 0) {
      const firstOther = this._messages.find((m) => m.userId !== userId);
      this._unreadSeparatorId = firstOther?.id ?? null;
    }

    this._renderAllMessages(unreadCount);

    if (this._unreadSeparatorId) {
      requestAnimationFrame(() => {
        const sep = this.getContentEl()?.querySelector('#unread-separator');
        sep ? sep.scrollIntoView({ behavior: 'smooth', block: 'start' })
            : this._scrollToBottom(false);
      });
    } else {
      this._scrollToBottom(false);
    }

    await this._markAllRead();
  }

  async _markAllRead() {
    const res = await api.chat.markRead({ lgaId: this._activeLgaId });
    if (res.data) {
      store.unreadChatCount = 0;
      // Clear unread badge on the active LGA in the sidebar
      const preview = this._allPreviews.find((p) => p.id === this._activeLgaId);
      if (preview) preview.unreadCount = 0;
      const activeBtn = this.getContentEl()?.querySelector(`.chat-list-item[data-lga-id="${this._activeLgaId}"] .chat-list-item__unread-badge`);
      if (activeBtn) activeBtn.remove();
    }
  }

  async _loadOnlineCount() {
    const res = await api.chat.getOnlineCount({ lgaId: this._activeLgaId });
    const el = this.getContentEl()?.querySelector('#online-count');
    if (el && res.data) {
      el.innerHTML = `<span class="chat-header__online-dot" aria-hidden="true"></span>${res.data.count} active members`;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  _renderAllMessages(unreadCount = 0) {
    const body = this.getContentEl()?.querySelector('#chat-body');
    if (!body) return;
    body.innerHTML = '';
    this._lastRenderedDate = null;

    for (const msg of this._messages) {
      const msgDate = new Date(msg.createdAt).toDateString();
      if (msgDate !== this._lastRenderedDate) {
        const sep = document.createElement('div');
        sep.className = 'chat-date-sep';
        const sepSpan = document.createElement('span');
        sepSpan.textContent = `${isToday(msg.createdAt) ? 'TODAY, ' : ''}${new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}`;
        sep.setAttribute('aria-label', sepSpan.textContent);
        sep.appendChild(sepSpan);
        body.appendChild(sep);
        this._lastRenderedDate = msgDate;
      }

      if (msg.id === this._unreadSeparatorId) {
        const unreadSep = document.createElement('div');
        unreadSep.className = 'chat-unread-sep';
        unreadSep.id = 'unread-separator';
        unreadSep.innerHTML = `<span>${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}</span>`;
        unreadSep.setAttribute('aria-label', `${unreadCount} unread messages below`);
        body.appendChild(unreadSep);
      }

      body.appendChild(this._createMessageEl(msg));
    }
  }

  _createMessageEl(msg) {
    const isOwn = msg.userId === store.currentUser?.id;
    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg ${isOwn ? 'chat-msg--own' : ''}`;
    wrapper.dataset.msgId = msg.id;

    const avatarHtml = Avatar.html({ name: msg.userName, imageUrl: msg.avatarUrl, size: 'sm' });

    const replyHtml = msg.replyTo ? `
      <div class="chat-msg__reply" data-reply-id="${msg.replyTo.id}">
        <span class="chat-msg__reply-name">${this.esc(msg.replyTo.userName)}</span>
        <span class="chat-msg__reply-text">${this.esc(msg.replyTo.text?.slice(0, 60))}${(msg.replyTo.text?.length > 60) ? '…' : ''}</span>
      </div>
    ` : '';

    const bodyHtml = msg.fileUrl ? `
      <a href="${this.esc(msg.fileUrl)}" class="chat-msg__file" target="_blank" rel="noopener noreferrer" aria-label="Open ${this.esc(msg.fileName || 'file')}">
        <div class="chat-msg__file-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="chat-msg__file-info">
          <span class="chat-msg__file-name">${this.esc(msg.fileName || 'File')}</span>
          ${msg.fileSize ? `<span class="chat-msg__file-size">${this.esc(msg.fileSize)}</span>` : ''}
        </div>
        ${!isOwn ? `<span class="chat-msg__file-download" data-download-url="${this.esc(msg.fileUrl)}" data-download-name="${this.esc(msg.fileName || 'file')}" role="button" tabindex="0" aria-label="Download ${this.esc(msg.fileName || 'file')}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>` : ''}
      </a>
    ` : msg.text ? `<p class="chat-msg__text">${this.esc(msg.text)}</p>` : '';

    wrapper.innerHTML = `
      <div class="chat-msg__avatar">${!isOwn ? `<a class="chat-msg__name" href="/north/u/${this.esc(msg.userName)}">${avatarHtml}</a>` : avatarHtml}</div>
      <div class="chat-msg__content">
        ${!isOwn ? `<a class="chat-msg__name" href="/north/u/${this.esc(msg.userName)}">${this.esc(msg.userName)}</a>` : ''}
        <div class="chat-msg__bubble ${isOwn ? 'chat-msg__bubble--own' : ''}">
          ${replyHtml}
          ${bodyHtml}
          <span class="chat-msg__time">${formatTime(msg.createdAt)}${isOwn ? ' <span class="chat-msg__you">YOU</span>' : ''}</span>
        </div>
        ${this._renderReactions(msg)}
      </div>
    `;
    return wrapper;
  }

  _renderReactions(msg) {
    if (!msg.reactions || !Object.keys(msg.reactions).length) return '';
    const userId = store.currentUser?.id;
    const chips = Object.entries(msg.reactions).map(([emoji, users]) => {
      const reacted = users.includes(userId);
      return `<button class="chat-reaction ${reacted ? 'chat-reaction--active' : ''}" data-msg-id="${msg.id}" data-emoji="${emoji}" type="button" aria-label="React with ${emoji}: ${users.length}">${emoji} ${users.length}</button>`;
    }).join('');
    return `<div class="chat-reactions-row">${chips}</div>`;
  }

  _appendMessage(msg) {
    const body = this.getContentEl()?.querySelector('#chat-body');
    if (!body) return;

    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== this._lastRenderedDate) {
      const sep = document.createElement('div');
      const sepSpan = document.createElement('span');
      sep.className = 'chat-date-sep';
      sepSpan.textContent = `${isToday(msg.createdAt) ? 'TODAY, ' : ''}${new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}`;
      sep.setAttribute('aria-label', sepSpan.textContent);
      sep.appendChild(sepSpan);
      body.appendChild(sep);
      this._lastRenderedDate = msgDate;
    }

    body.appendChild(this._createMessageEl(msg));
    this._scrollToBottom(true);
  }

  _scrollToBottom(smooth = true) {
    const body = this.getContentEl()?.querySelector('#chat-body');
    if (body) body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  // ── Events ────────────────────────────────────────────────────────────

  _bindEvents() {
    const el = this.getContentEl();
    if (!el) return;

    const textarea = el.querySelector('#chat-textarea');
    if (textarea) {
      this.on(textarea, 'input', () => this._autoResizeTextarea(textarea));
      this.on(textarea, 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleSend(); }
      });
    }

    const sendBtn = el.querySelector('#send-btn');
    if (sendBtn) this.on(sendBtn, 'click', () => this._handleSend());

    const attachBtn = el.querySelector('#attach-btn');
    const fileInput = el.querySelector('#file-input');
    if (attachBtn && fileInput) {
      this.on(attachBtn, 'click', () => fileInput.click());
      this.on(fileInput, 'change', (e) => this._handleFileAttach(e));
    }

    this.delegate('.chat-msg__file-download', 'click', (e, span) => {
      e.preventDefault(); e.stopPropagation();
      const a = document.createElement('a');
      a.href = span.dataset.downloadUrl; a.download = span.dataset.downloadName; a.click();
    });

    const emojiBtn = el.querySelector('#emoji-btn');
    const emojiPanel = el.querySelector('#chat-emoji-panel');
    if (emojiBtn && emojiPanel) {
      this.on(emojiBtn, 'click', (e) => {
        e.stopPropagation();
        this._emojiPanelOpen = !this._emojiPanelOpen;
        emojiPanel.classList.toggle('chat-emoji-panel--open', this._emojiPanelOpen);
        emojiPanel.setAttribute('aria-hidden', String(!this._emojiPanelOpen));
        emojiBtn.setAttribute('aria-expanded', String(this._emojiPanelOpen));
      });
      this.on(emojiPanel, 'click', (e) => e.stopPropagation());
      this.delegate('.chat-emoji-panel__item', 'click', (e, btn) => {
        const emoji = btn.dataset.emoji;
        if (textarea) {
          const pos = textarea.selectionStart, val = textarea.value;
          textarea.value = val.slice(0, pos) + emoji + val.slice(pos);
          textarea.selectionStart = textarea.selectionEnd = pos + emoji.length;
          textarea.focus(); this._autoResizeTextarea(textarea);
        }
        this._emojiPanelOpen = false;
        emojiPanel.classList.remove('chat-emoji-panel--open');
        emojiPanel.setAttribute('aria-hidden', 'true');
        emojiBtn.setAttribute('aria-expanded', 'false');
      });
    }

    this.on(el.querySelector('#chat-body'), 'contextmenu', (e) => {
      const msgEl = e.target.closest('.chat-msg');
      if (!msgEl) return;
      e.preventDefault();
      this._openContextMenu(msgEl.dataset.msgId, e.clientX, e.clientY);
    });

    this.delegate('.chat-context-menu__item', 'click', (e, btn) => this._handleContextAction(btn.dataset.action));

    this.delegate('.chat-context-menu__emoji:not(#context-emoji-more)', 'click', (e, btn) => {
      if (this._contextTarget) { this._handleReaction(this._contextTarget, btn.dataset.emoji); this._closeContextMenu(); }
    });

    const ctxMore = el.querySelector('#context-emoji-more');
    if (ctxMore) {
      this.on(ctxMore, 'click', (e) => {
        e.stopPropagation();
        const grid = el.querySelector('#context-emoji-grid');
        const expanded = grid?.hasAttribute('inert') === false;
        if (grid) {
          if (expanded) { grid.setAttribute('inert', ''); grid.classList.remove('chat-context-menu__emoji-grid--open'); ctxMore.setAttribute('aria-expanded', 'false'); }
          else { grid.removeAttribute('inert'); grid.classList.add('chat-context-menu__emoji-grid--open'); ctxMore.setAttribute('aria-expanded', 'true'); }
        }
      });
    }

    this.delegate('.chat-context-menu__emoji--grid', 'click', (e, btn) => {
      if (this._contextTarget) { this._handleReaction(this._contextTarget, btn.dataset.emoji); this._closeContextMenu(); }
    });

    this.delegate('.chat-reaction', 'click', (e, btn) => this._handleReaction(btn.dataset.msgId, btn.dataset.emoji));

    const replyClose = el.querySelector('#reply-bar-close');
    if (replyClose) this.on(replyClose, 'click', () => this._clearReply());

    this.delegate('.chat-msg__reply', 'click', (e, el) => {
      if (el.dataset.replyId) this._scrollToMessage(el.dataset.replyId);
    });

    const searchToggle = el.querySelector('#search-toggle-btn');
    const searchInput = el.querySelector('#search-input');
    const searchClose = el.querySelector('#search-close');
    const searchPrev = el.querySelector('#search-prev');
    const searchNext = el.querySelector('#search-next');
    if (searchToggle) this.on(searchToggle, 'click', () => this._openSearch());
    if (searchClose) this.on(searchClose, 'click', () => this._closeSearch());
    if (searchInput) {
      this.on(searchInput, 'input', () => this._runSearch(searchInput.value));
      this.on(searchInput, 'keydown', (e) => {
        if (e.key === 'Enter') { e.shiftKey ? this._searchStep(-1) : this._searchStep(1); }
        if (e.key === 'Escape') this._closeSearch();
      });
    }
    if (searchPrev) this.on(searchPrev, 'click', () => this._searchStep(-1));
    if (searchNext) this.on(searchNext, 'click', () => this._searchStep(1));

    const kebabBtn = el.querySelector('#kebab-btn');
    const kebabMenu = el.querySelector('#chat-kebab-menu');
    if (kebabBtn && kebabMenu) {
      this.on(kebabBtn, 'click', (e) => {
        e.stopPropagation();
        const open = kebabMenu.classList.toggle('chat-kebab-menu--open');
        kebabMenu.setAttribute('aria-hidden', String(!open));
        kebabBtn.setAttribute('aria-expanded', String(open));
      });
      this.delegate('.chat-kebab-menu__item', 'click', (e, btn) => {
        this._handleKebab(btn.dataset.kebab);
        kebabMenu.classList.remove('chat-kebab-menu--open');
        kebabMenu.setAttribute('aria-hidden', 'true');
      });
    }

    const inviteBtn = el.querySelector('#invite-btn');
    const inviteBackdrop = el.querySelector('#invite-backdrop');
    const inviteClose = el.querySelector('#invite-close');
    const inviteCancel = el.querySelector('#invite-cancel');
    const inviteSend = el.querySelector('#invite-send');
    if (inviteBtn) this.on(inviteBtn, 'click', () => this._openInviteModal());
    if (inviteClose) this.on(inviteClose, 'click', () => this._closeInviteModal());
    if (inviteCancel) this.on(inviteCancel, 'click', () => this._closeInviteModal());
    if (inviteBackdrop) this.on(inviteBackdrop, 'click', (e) => { if (e.target === inviteBackdrop) this._closeInviteModal(); });
    if (inviteSend) this.on(inviteSend, 'click', () => this._handleInvite());

    const invitePhone = el.querySelector('#invite-phone');
    if (invitePhone) this.on(invitePhone, 'keydown', (e) => { if (e.key === 'Enter') this._handleInvite(); });

    const reportClose = el.querySelector('#report-close');
    const reportCancel = el.querySelector('#report-cancel');
    const reportBackdrop = el.querySelector('#report-backdrop');
    const reportSubmit = el.querySelector('#report-submit');
    if (reportClose) this.on(reportClose, 'click', () => this._closeReportModal());
    if (reportCancel) this.on(reportCancel, 'click', () => this._closeReportModal());
    if (reportBackdrop) this.on(reportBackdrop, 'click', (e) => { if (e.target === reportBackdrop) this._closeReportModal(); });
    if (reportSubmit) this.on(reportSubmit, 'click', () => this._handleReport());
    this.delegate('.chat-report-reason', 'click', (e, btn) => {
      this._reportReason = btn.dataset.reason;
      el.querySelectorAll('.chat-report-reason').forEach(b => b.classList.remove('chat-report-reason--active'));
      btn.classList.add('chat-report-reason--active');
      const sub = el.querySelector('#report-submit');
      if (sub) sub.disabled = false;
    });

    const membersClose = el.querySelector('#members-close');
    const membersBackdrop = el.querySelector('#members-backdrop');
    if (membersClose) this.on(membersClose, 'click', () => this._closeMembersModal());
    if (membersBackdrop) this.on(membersBackdrop, 'click', (e) => { if (e.target === membersBackdrop) this._closeMembersModal(); });

    this.on(document, 'click', () => {
      this._closeContextMenu();
      const kebab = el.querySelector('#chat-kebab-menu');
      const kBtn = el.querySelector('#kebab-btn');
      if (kebab) { kebab.classList.remove('chat-kebab-menu--open'); kebab.setAttribute('aria-hidden', 'true'); }
      if (kBtn) kBtn.setAttribute('aria-expanded', 'false');
      if (this._emojiPanelOpen) {
        this._emojiPanelOpen = false;
        const panel = el.querySelector('#chat-emoji-panel');
        const eBtn = el.querySelector('#emoji-btn');
        if (panel) { panel.classList.remove('chat-emoji-panel--open'); panel.setAttribute('aria-hidden', 'true'); }
        if (eBtn) eBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Send ──────────────────────────────────────────────────────────────

  async _handleSend() {
    const el = this.getContentEl();
    const textarea = el?.querySelector('#chat-textarea');
    const text = textarea?.value.trim();
    if (!text || this._sending) return;
    this._sending = true;
    try {
      const replyTo = this._replyTo;
      const optimistic = {
        id: Date.now(),
        lgaId: this._activeLgaId,
        userId: store.currentUser?.id,
        userName: store.currentUser?.username || store.currentUser?.name,
        avatarUrl: store.currentUser?.avatarUrl,
        text, mediaUrl: null, fileUrl: null, fileName: null, fileSize: null,
        reactions: {}, replyTo, createdAt: new Date().toISOString(), _pending: true,
      };
      textarea.value = '';
      this._autoResizeTextarea(textarea);
      this._clearReply();
      this._appendMessage(optimistic);
      this._messages.push(optimistic);

      const res = await api.chat.sendMessage({ lgaId: this._activeLgaId, text, replyTo });
      const pendingEl = el?.querySelector(`.chat-msg[data-msg-id="${optimistic.id}"]`);

      if (res.error) {
        pendingEl?.classList.add('chat-msg--failed');
        const msg = res.error.code === 'FEATURE_DISABLED'
            ? 'Community chat has been disabled by the administrator.'
            : res.error.code === 'PROFANITY'
                ? res.error.message
                : 'Message failed to send.';
        showToast('error', msg);
        return;
      }

      if (pendingEl) pendingEl.replaceWith(this._createMessageEl(res.data));
      const idx = this._messages.findIndex((m) => m.id === optimistic.id);
      if (idx > -1) this._messages[idx] = res.data;
    } finally {
      this._sending = false;
    }
  }

  // ── File attach ───────────────────────────────────────────────────────

  async _handleFileAttach(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > 20 * 1024 * 1024) {
      showToast('error', 'File must be under 20MB.');
      return;
    }

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const blobUrl = URL.createObjectURL(file);
    this._objectURLs.add(blobUrl);
    const optimisticId = Date.now();
    const optimistic = {
      id: optimisticId, lgaId: this._activeLgaId,
      userId: store.currentUser?.id, userName: store.currentUser?.name,
      avatarUrl: store.currentUser?.avatarUrl,
      text: null, mediaUrl: null, fileUrl: blobUrl,
      fileName: file.name, fileSize: `${sizeMB} MB`,
      reactions: {}, replyTo: null, createdAt: new Date().toISOString(), _pending: true,
    };
    this._appendMessage(optimistic);
    this._messages.push(optimistic);

    const uploadRes = await api.chat.uploadFile(file);
    if (uploadRes.error) {
      const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
      pendingEl?.classList.add('chat-msg--failed');
      URL.revokeObjectURL(blobUrl);
      this._objectURLs.delete(blobUrl);
      showToast('error', 'File upload failed.');
      return;
    }

    const { url, fileName, fileSize, isImage } = uploadRes.data;
    const msgRes = await api.chat.sendMessage({
      lgaId: this._activeLgaId,
      fileUrl: url,
      fileName: fileName || file.name,
      fileSize: `${sizeMB} MB`,
      mediaUrl: isImage ? url : null,
    });

    const pendingEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${optimisticId}"]`);
    URL.revokeObjectURL(blobUrl);
    this._objectURLs.delete(blobUrl);

    if (msgRes.error) {
      pendingEl?.classList.add('chat-msg--failed');
      showToast('error', 'Failed to send file.');
      return;
    }
    if (pendingEl) pendingEl.replaceWith(this._createMessageEl(msgRes.data));
    const idx = this._messages.findIndex((m) => m.id === optimisticId);
    if (idx > -1) this._messages[idx] = msgRes.data;
  }

  // ── Reactions ─────────────────────────────────────────────────────────

  async _handleReaction(msgId, emoji) {
    const res = await api.chat.toggleReaction(msgId, emoji);
    if (res.error) { showToast('error', 'Could not add reaction.'); return; }

    const msg = this._messages.find((m) => String(m.id) === String(msgId));
    if (msg) msg.reactions = res.data.reactions;

    const msgEl = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
    if (msgEl) {
      const existing = msgEl.querySelector('.chat-reactions-row');
      const updated = this._messages.find((m) => String(m.id) === String(msgId));
      const newHtml = this._renderReactions(updated);
      if (existing) existing.outerHTML = newHtml || '';
      else if (newHtml) msgEl.querySelector('.chat-msg__content')?.insertAdjacentHTML('beforeend', newHtml);
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────

  _openContextMenu(msgId, x, y) {
    this._contextTarget = msgId;
    const menu = this.getContentEl()?.querySelector('#chat-context-menu');
    if (!menu) return;

    // Swap Report ↔ Delete depending on message ownership
    const msg = this._messages.find((m) => String(m.id) === String(msgId));
    const isOwn = msg && msg.userId === store.currentUser?.id;
    const actionBtn = menu.querySelector('[data-action="report"], [data-action="delete"]');
    if (actionBtn) {
      if (isOwn) {
        actionBtn.dataset.action = 'delete';
        actionBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete`;
      } else {
        actionBtn.dataset.action = 'report';
        actionBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Report`;
      }
    }

    menu.classList.add('chat-context-menu--open');
    menu.removeAttribute('inert');
    const vw = window.innerWidth, vh = window.innerHeight;
    menu.style.setProperty('--ctx-x', `${Math.min(x, vw - 200)}px`);
    menu.style.setProperty('--ctx-y', `${Math.min(y, vh - 220)}px`);
  }

  _closeContextMenu() {
    const el = this.getContentEl();
    const menu = el?.querySelector('#chat-context-menu');
    if (menu) { menu.classList.remove('chat-context-menu--open'); menu.setAttribute('inert', ''); }
    const grid = el?.querySelector('#context-emoji-grid');
    const ctxMore = el?.querySelector('#context-emoji-more');
    if (grid) { grid.setAttribute('inert', ''); grid.classList.remove('chat-context-menu__emoji-grid--open'); }
    if (ctxMore) ctxMore.setAttribute('aria-expanded', 'false');
    this._contextTarget = null;
  }

  _handleContextAction(action) {
    const msg = this._messages.find((m) => String(m.id) === String(this._contextTarget));
    this._closeContextMenu();
    if (!msg) return;
    if (action === 'copy') {
      navigator.clipboard?.writeText(msg.text || msg.fileName || '').then(() => showToast('success', 'Copied to clipboard.'));
    } else if (action === 'reply') {
      this._setReply(msg);
    } else if (action === 'report') {
      this._openReportModal(msg.id);
    } else if (action === 'delete') {
      this._deleteMessage(msg.id);
    }
  }

  // ── Delete own message ────────────────────────────────────────────────

  async _deleteMessage(msgId) {
    const res = await api.chat.deleteMessage(msgId);
    if (res.error) {
      showToast('error', res.error.message || 'Could not delete message.');
      return;
    }
    this._messages = this._messages.filter((m) => String(m.id) !== String(msgId));
    const msgEl = this.getContentEl()?.querySelector(`[data-msg-id="${msgId}"]`);
    if (msgEl) msgEl.remove();
    showToast('success', 'Message deleted.');
  }

  // ── Report ────────────────────────────────────────────────────────────

  _openReportModal(msgId) {
    this._reportMsgId = msgId;
    this._reportReason = null;
    const backdrop = this.getContentEl()?.querySelector('#report-backdrop');
    const submit = this.getContentEl()?.querySelector('#report-submit');
    const errEl = this.getContentEl()?.querySelector('#report-error');
    this.getContentEl()?.querySelectorAll('.chat-report-reason').forEach(b => b.classList.remove('chat-report-reason--active'));
    if (submit) submit.disabled = true;
    if (errEl) errEl.textContent = '';
    if (backdrop) { backdrop.classList.add('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'false'); }
  }

  _closeReportModal() {
    this._reportMsgId = null;
    this._reportReason = null;
    const backdrop = this.getContentEl()?.querySelector('#report-backdrop');
    if (backdrop) { backdrop.classList.remove('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'true'); }
  }

  async _handleReport() {
    if (!this._reportMsgId || !this._reportReason) return;
    const submitBtn = this.getContentEl()?.querySelector('#report-submit');
    const errEl = this.getContentEl()?.querySelector('#report-error');
    if (submitBtn) submitBtn.textContent = 'Submitting…';
    const res = await api.chat.reportMessage(this._reportMsgId, this._reportReason);
    if (submitBtn) submitBtn.textContent = 'Submit Report';
    if (res.error) {
      if (errEl) errEl.textContent = res.error.message || 'Could not submit report.';
      return;
    }
    this._closeReportModal();
    showToast('success', 'Message reported. Thank you.');
  }

  // ── Reply ─────────────────────────────────────────────────────────────

  _setReply(msg) {
    this._replyTo = { id: msg.id, userName: msg.userName, text: msg.text || msg.fileName || '' };
    const bar = this.getContentEl()?.querySelector('#chat-reply-bar');
    const content = this.getContentEl()?.querySelector('#reply-bar-content');
    if (bar && content) {
      content.innerHTML = `
        <span class="chat-reply-bar__name">${this.esc(msg.userName)}</span>
        <span class="chat-reply-bar__text">${this.esc((msg.text || msg.fileName || '').slice(0, 80))}</span>
      `;
      bar.classList.add('chat-reply-bar--open');
      bar.setAttribute('aria-hidden', 'false');
    }
    this.getContentEl()?.querySelector('#chat-textarea')?.focus();
  }

  _clearReply() {
    this._replyTo = null;
    const bar = this.getContentEl()?.querySelector('#chat-reply-bar');
    if (bar) { bar.classList.remove('chat-reply-bar--open'); bar.setAttribute('aria-hidden', 'true'); }
  }

  _scrollToMessage(msgId) {
    const el = this.getContentEl()?.querySelector(`.chat-msg[data-msg-id="${msgId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('chat-msg--highlight');
      setTimeout(() => el.classList.remove('chat-msg--highlight'), 1500);
    }
  }

  // ── Search ────────────────────────────────────────────────────────────

  _openSearch() {
    this._searchActive = true;
    const bar = this.getContentEl()?.querySelector('#chat-search-bar');
    const input = this.getContentEl()?.querySelector('#search-input');
    if (bar) { bar.classList.add('chat-search-bar--open'); bar.setAttribute('aria-hidden', 'false'); }
    setTimeout(() => input?.focus(), 100);
  }

  _closeSearch() {
    this._searchActive = false;
    this._clearSearchHighlights();
    const bar = this.getContentEl()?.querySelector('#chat-search-bar');
    const input = this.getContentEl()?.querySelector('#search-input');
    if (bar) { bar.classList.remove('chat-search-bar--open'); bar.setAttribute('aria-hidden', 'true'); }
    if (input) input.value = '';
    this._updateSearchNav();
  }

  _runSearch(query) {
    this._clearSearchHighlights();
    this._searchQuery = query.trim().toLowerCase();
    this._searchMatches = [];
    this._searchIdx = 0;
    if (!this._searchQuery) { this._updateSearchNav(); return; }
    this.getContentEl()?.querySelector('#chat-body')?.querySelectorAll('.chat-msg').forEach((msgEl) => {
      const text = msgEl.querySelector('.chat-msg__text')?.textContent.toLowerCase() || '';
      if (text.includes(this._searchQuery)) {
        msgEl.classList.add('chat-msg--search-match');
        this._searchMatches.push(Number(msgEl.dataset.msgId));
      }
    });
    if (this._searchMatches.length) this._searchStep(0, true);
    this._updateSearchNav();
  }

  _searchStep(delta, init = false) {
    if (!this._searchMatches.length) return;
    if (!init) this._searchIdx = (this._searchIdx + delta + this._searchMatches.length) % this._searchMatches.length;
    this._scrollToMessage(this._searchMatches[this._searchIdx]);
    this._updateSearchNav();
  }

  _clearSearchHighlights() {
    this.getContentEl()?.querySelectorAll('.chat-msg--search-match').forEach((el) => el.classList.remove('chat-msg--search-match'));
  }

  _updateSearchNav() {
    const nav = this.getContentEl()?.querySelector('#search-nav');
    const prev = this.getContentEl()?.querySelector('#search-prev');
    const next = this.getContentEl()?.querySelector('#search-next');
    const total = this._searchMatches.length;
    if (nav) nav.textContent = total ? `${this._searchIdx + 1} / ${total}` : (this._searchQuery ? '0 results' : '');
    if (prev) prev.disabled = total < 2;
    if (next) next.disabled = total < 2;
  }

  // ── Kebab ─────────────────────────────────────────────────────────────

  _handleKebab(action) {
    if (action === 'mute') showToast('success', 'Notifications muted.');
    else if (action === 'members') this._openMembersModal();
    else if (action === 'clear') {
      const body = this.getContentEl()?.querySelector('#chat-body');
      if (body) body.innerHTML = '';
      this._messages = []; this._lastRenderedDate = null;
      for (const url of this._objectURLs) URL.revokeObjectURL(url);
      this._objectURLs.clear();
      showToast('success', 'Chat cleared locally.');
    }
  }

  // ── Invite ────────────────────────────────────────────────────────────

  _openInviteModal() {
    const backdrop = this.getContentEl()?.querySelector('#invite-backdrop');
    if (backdrop) { backdrop.classList.add('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'false'); }
    setTimeout(() => this.getContentEl()?.querySelector('#invite-phone')?.focus(), 100);
  }

  _closeInviteModal() {
    const backdrop = this.getContentEl()?.querySelector('#invite-backdrop');
    if (backdrop) { backdrop.classList.remove('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'true'); }
    const phone = this.getContentEl()?.querySelector('#invite-phone');
    const err = this.getContentEl()?.querySelector('#invite-error');
    if (phone) phone.value = '';
    if (err) err.textContent = '';
  }

  async _handleInvite() {
    const phoneEl = this.getContentEl()?.querySelector('#invite-phone');
    const errEl = this.getContentEl()?.querySelector('#invite-error');
    const sendBtn = this.getContentEl()?.querySelector('#invite-send');
    const phone = phoneEl?.value.trim();
    if (!phone) { if (errEl) errEl.textContent = 'Please enter a phone number.'; return; }
    if (errEl) errEl.textContent = '';
    if (sendBtn) sendBtn.textContent = 'Sending…';
    const res = await api.chat.inviteMember(phone);
    if (sendBtn) sendBtn.textContent = 'Send Invite';
    if (res.error) { if (errEl) errEl.textContent = res.error.message; return; }
    this._closeInviteModal();
    showToast('success', 'Invite sent!');
  }

  // ── Members ───────────────────────────────────────────────────────────

  async _openMembersModal() {
    const backdrop = this.getContentEl()?.querySelector('#members-backdrop');
    if (backdrop) { backdrop.classList.add('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'false'); }
    const list = this.getContentEl()?.querySelector('#members-list');
    if (list) list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Loading…</p>';

    const res = await api.chat.getMembers();
    if (!list) return;
    if (res.error) { list.innerHTML = '<p style="color:var(--color-error);">Failed to load members.</p>'; return; }

    const members = res.data || [];
    if (!members.length) { list.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">No members found.</p>'; return; }

    list.innerHTML = members.map((m) => `
      <div class="chat-member-row">
        <div class="chat-member-row__avatar">
          ${m.avatarUrl
        ? `<img src="${this.esc(m.avatarUrl)}" alt="" width="36" height="36" style="border-radius:50%;object-fit:cover;" />`
        : `<div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary-light);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--color-primary);">${this.esc(m.name?.charAt(0)?.toUpperCase() || '?')}</div>`
    }
        </div>
        <div class="chat-member-row__info">
          <p class="chat-member-row__name">${this.esc(m.name)}</p>
          <p class="chat-member-row__status">${m.status === 'active' ? 'Active' : 'Inactive'}</p>
        </div>
      </div>
    `).join('');
  }

  _closeMembersModal() {
    const backdrop = this.getContentEl()?.querySelector('#members-backdrop');
    if (backdrop) { backdrop.classList.remove('chat-modal-backdrop--open'); backdrop.setAttribute('aria-hidden', 'true'); }
  }

  // ── Utilities ─────────────────────────────────────────────────────────

  _autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  beforeUnmount() {
    // Deregister SSE message handler — we don't want messages
    // appended to a DOM that no longer exists
    sseClient.onMessage(null);

    for (const url of this._objectURLs) URL.revokeObjectURL(url);
    this._objectURLs.clear();
  }
}
