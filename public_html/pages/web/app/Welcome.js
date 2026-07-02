/**
 * KTG Connect — Welcome Page
 * Route: /welcome
 * ============================================================
 * Shown exactly once — the first time a user logs in after
 * creating their account. Never shown again after that.
 *
 * Guard logic (in router):
 *   On login, if user.has_seen_welcome === false → router.replace('/welcome')
 *   Otherwise → router.replace('/home')
 *
 * Extends WebLayout — renders inside the sidebar + topbar shell.
 * Content is a single centred card on the page body.
 *
 * On mount: immediately calls api.users.markWelcomeSeen() so that
 * if the user navigates away before clicking Get Started, they
 * won't see the welcome page again on next login.
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js';
import { Button } from '../../../components/base/Button.js';
import { router } from '../../../core/router.js';
import { store, showToast, setPageLoading } from '../../../core/store.js';
import { api } from '../../../api/client.js';
import { t } from '../../../core/i18n.js';

export default class WelcomePage extends WebLayout {
  static styles = '/pages/web/app/Welcome.css';

  constructor(props) {
    super({ title: 'Welcome', ...props });
    this._user = store.currentUser;
  }

  getContent() {
    const firstName = this._user?.name?.split(' ')[0] || 'there';
    const lgaName = this._user?.lgaName || store.currentLGA?.name || 'your LGA';
    const lgaId = this._user?.lgaId || store.currentLGA?.id || '';

    return `
      <div class="welcome-page">
        <div class="welcome-card">

          <!-- Corner accent -->
          <div class="welcome-card__corner" aria-hidden="true"></div>

          <!-- Icon -->
          <div class="welcome-card__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <!-- LGA pill -->
          <div class="welcome-card__lga-pill">
            ${this.esc(lgaName.toUpperCase())} ${this.esc(t('welcome.communitySuffix'))}
          </div>

          <!-- Heading -->
          <div class="welcome-card__heading">
            <h1 class="welcome-card__title">
              ${this.esc(t('welcome.titlePre'))} <span class="welcome-card__title-brand">KTG Connect</span>${this.esc(t('welcome.titlePost', { name: firstName }))}
            </h1>
            <p class="welcome-card__subtitle">
              ${this.esc(t('welcome.subtitle', { lga: lgaName }))}
            </p>
          </div>

          <!-- Feature cards -->
          <div class="welcome-card__features">

            <div class="welcome-card__feature">
              <div class="welcome-card__feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </div>
              <h3 class="welcome-card__feature-title">${this.esc(t('welcome.stayInformed'))}</h3>
              <p class="welcome-card__feature-desc">${this.esc(t('welcome.stayInformedDesc'))}</p>
            </div>

            <div class="welcome-card__feature">
              <div class="welcome-card__feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  <line x1="9" y1="10" x2="15" y2="10"/>
                  <line x1="9" y1="14" x2="13" y2="14"/>
                </svg>
              </div>
              <h3 class="welcome-card__feature-title">${this.esc(t('welcome.participate'))}</h3>
              <p class="welcome-card__feature-desc">${this.esc(t('welcome.participateDesc'))}</p>
            </div>

            <div class="welcome-card__feature">
              <div class="welcome-card__feature-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <h3 class="welcome-card__feature-title">${this.esc(t('welcome.directContact'))}</h3>
              <p class="welcome-card__feature-desc">${this.esc(t('welcome.directContactDesc'))}</p>
            </div>

          </div>

          <!-- CTA button -->
          <div class="welcome-card__cta" id="cta-mount"></div>

          <!-- Change LGA link -->
          <p class="welcome-card__lga-change">
            ${this.esc(t('welcome.notIn', { lga: lgaName }))}
            <button class="welcome-card__lga-change-btn" id="change-lga-btn" type="button">${this.esc(t('welcome.changeLGA'))}</button>
          </p>

        </div>
      </div>
    `;
  }

  onContentReady() {
    setPageLoading(true);
    // Mark welcome as seen immediately — fire and forget
    api.users.markWelcomeSeen();

    // Get Started button
    const ctaBtn = this.addChild(new Button({
      label: t('welcome.getStarted'),
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
      iconPosition: 'right',
      variant: 'primary',
      size: 'lg',
      fullWidth: true,
      onClick: () => router.replace('/home'),
    }));
    const mount = this.getContentEl()?.querySelector('#cta-mount');
    if (mount) ctaBtn.mount(mount);

    // Change LGA — opens the global SelectLGAModal singleton
    const changeLgaBtn = this.getContentEl()?.querySelector('#change-lga-btn');
    if (changeLgaBtn) {
      this.on(changeLgaBtn, 'click', () => {
        window._selectLGAModal?.open();
      });
    }
    setPageLoading(false);
  }
}
