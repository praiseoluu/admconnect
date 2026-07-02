/**
 * Adamawa Konect — Welcome Page (South)
 * ============================================================
 * Route: /south/welcome
 *
 * Shown exactly once — the first time a user logs in after
 * creating their account. Never shown again after that.
 *
 * Guard logic (in router):
 *   On login, if user.has_seen_welcome === false →
 *     router.replace('/south/welcome')
 *   Otherwise →
 *     router.replace('/south/home')
 *
 * Extends WebLayout — renders inside the sidebar + topbar shell.
 * Content is a single centred card on the page body.
 *
 * On mount: immediately calls api.users.markWelcomeSeen() so that
 * if the user navigates away before clicking "Get Started", they
 * won't see the welcome page again on next login.
 *
 * @module  WelcomePage
 * @version 2.0.0
 */

import { WebLayout }   from '../../../components/layout/BaseLayout.js';
import { Button }      from '../../../components/base/Button.js';
import { router }      from '../../../core/router.js';
import { store, setPageLoading } from '../../../core/store.js';
import { api }         from '../../../api/client.js';
import { t }           from '../../../core/i18n.js';

/* ── Constants ──────────────────────────────────────────────────────────── */
const REGION_BRAND = 'ADMConnect - South';
const HOME_ROUTE   = '/south/home';

const FEATURES = Object.freeze([
  {
    id:    'informed',
    icon:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>`,
    titleKey: 'welcome.stayInformed',
    descKey:  'welcome.stayInformedDesc',
  },
  {
    id:    'participate',
    icon:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              <line x1="9" y1="10" x2="15" y2="10"/>
              <line x1="9" y1="14" x2="13" y2="14"/>
            </svg>`,
    titleKey: 'welcome.participate',
    descKey:  'welcome.participateDesc',
  },
  {
    id:    'contact',
    icon:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>`,
    titleKey: 'welcome.directContact',
    descKey:  'welcome.directContactDesc',
  },
]);

const ICON_CHECK = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

const ICON_ARROW = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
  <path d="M5 12h14M12 5l7 7-7 7"/>
</svg>`;

/* ══════════════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════════════ */
export default class WelcomePage extends WebLayout {
  static styles = '/pages/web/app/Welcome.css';

  constructor(props) {
    super({ title: 'Welcome', ...props });
    this._user = store.currentUser;
  }

  /* ── Derived data ─────────────────────────────────────────────────────── */

  /** @returns {string} */
  get _firstName() {
    return this._user?.name?.split(' ')[0] || 'there';
  }

  /** @returns {string} */
  get _lgaName() {
    return this._user?.lgaName || store.currentLGA?.name || 'your LGA';
  }

  /** @returns {string} */
  get _lgaId() {
    return this._user?.lgaId || store.currentLGA?.id || '';
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  getContent() {
    return `
      <div class="welcome-page">
        <div class="welcome-card" role="region" aria-labelledby="welcome-heading">

          ${this._renderCornerAccent()}
          ${this._renderIcon()}
          ${this._renderLGAPill()}
          ${this._renderHeading()}
          ${this._renderFeatures()}
          ${this._renderCTA()}
          ${this._renderChangeLGA()}

        </div>
      </div>
    `;
  }

  /* ── Section renderers ────────────────────────────────────────────────── */

  /** @private */
  _renderCornerAccent() {
    return `<div class="welcome-card__corner" aria-hidden="true"></div>`;
  }

  /** @private */
  _renderIcon() {
    return `
      <div class="welcome-card__icon" aria-hidden="true">
        ${ICON_CHECK}
      </div>
    `;
  }

  /** @private */
  _renderLGAPill() {
    return `
      <span class="welcome-card__lga-pill">
        ${this.esc(this._lgaName.toUpperCase())} ${this.esc(t('welcome.communitySuffix'))}
      </span>
    `;
  }

  /** @private */
  _renderHeading() {
    return `
      <div class="welcome-card__heading">
        <h1 class="welcome-card__title" id="welcome-heading">
          ${this.esc(t('welcome.titlePre'))}
          <span class="welcome-card__title-brand">${REGION_BRAND}</span>${this.esc(t('welcome.titlePost', { name: this._firstName }))}
        </h1>
        <p class="welcome-card__subtitle">
          ${this.esc(t('welcome.subtitle', { lga: this._lgaName }))}
        </p>
      </div>
    `;
  }

  /** @private */
  _renderFeatures() {
    const cards = FEATURES.map((f) => `
      <article class="welcome-card__feature" aria-labelledby="welcome-feat-${f.id}">
        <div class="welcome-card__feature-icon">
          ${f.icon}
        </div>
        <div class="welcome-card__feature-body">
          <h3 class="welcome-card__feature-title" id="welcome-feat-${f.id}">
            ${this.esc(t(f.titleKey))}
          </h3>
          <p class="welcome-card__feature-desc">
            ${this.esc(t(f.descKey))}
          </p>
        </div>
      </article>
    `).join('');

    return `
      <div class="welcome-card__features" role="list" aria-label="${this.esc(t('welcome.featuresLabel') || 'Key features')}">
        ${cards}
      </div>
    `;
  }

  /** @private */
  _renderCTA() {
    return `<div class="welcome-card__cta" id="cta-mount"></div>`;
  }

  /** @private */
  _renderChangeLGA() {
    return `
      <p class="welcome-card__lga-change">
        ${this.esc(t('welcome.notIn', { lga: this._lgaName }))}
        <button
          class="welcome-card__lga-change-btn"
          id="change-lga-btn"
          type="button"
          aria-label="${this.esc(t('welcome.changeLGALabel') || 'Change your Local Government Area')}"
        >
          ${this.esc(t('welcome.changeLGA'))}
        </button>
      </p>
    `;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  onContentReady() {
    setPageLoading(true);

    // Mark welcome as seen — fire and forget
    this._markWelcomeSeen();

    // Mount CTA button
    this._mountCTAButton();

    // Bind "Change LGA" action
    this._bindChangeLGA();

    setPageLoading(false);
  }

  /* ── Actions ──────────────────────────────────────────────────────────── */

  /** @private */
  _markWelcomeSeen() {
    try {
      api.users.markWelcomeSeen();
    } catch {
      // Non-critical — if it fails the router guard will handle it next time
    }
  }

  /** @private */
  _mountCTAButton() {
    const ctaBtn = this.addChild(new Button({
      label:        t('welcome.getStarted'),
      icon:         ICON_ARROW,
      iconPosition: 'right',
      variant:      'primary',
      size:         'lg',
      fullWidth:    true,
      ariaLabel:    t('welcome.getStartedLabel') || 'Get started — go to your home feed',
      onClick:      () => router.replace(HOME_ROUTE),
    }));

    const mount = this.getContentEl()?.querySelector('#cta-mount');
    if (mount) ctaBtn.mount(mount);
  }

  /** @private */
  _bindChangeLGA() {
    const changeLgaBtn = this.getContentEl()?.querySelector('#change-lga-btn');
    if (!changeLgaBtn) return;

    this.on(changeLgaBtn, 'click', () => {
      if (typeof window._selectLGAModal?.open === 'function') {
        window._selectLGAModal.open();
      }
    });
  }
}