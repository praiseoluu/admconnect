/**
 * Adamawa Konect — Landing Page Base Class
 * ============================================================
 * Abstract base that owns every behaviour shared between the
 * four landing pages (Landing, NorthLanding, CentralLanding,
 * SouthLanding):
 *
 *   • Public ad-carousel rendering & pagination
 *   • Auto-advance timer with hover-pause
 *   • Resize handling with rAF debounce
 *   • Smooth-scroll for in-page anchor links
 *   • Language-switcher, mobile-menu and scroll-shadow bootstrap
 *
 * Subclasses provide only their render() output and (optionally)
 * an onLandingReady() hook for region-specific behaviour.
 *
 * Subclass contract:
 *   class NorthLandingPage extends LandingBase {
 *     get region() { return 'north'; }
 *
 *     renderContent() {
 *       return `<section class="landing__hero">…</section>`;
 *     }
 *   }
 *
 * @module  LandingBase
 * @version 2.0.0
 */

import { Component }   from '../../../core/component.js';
import { PublicLayout } from './_PublicLayout.js';
import { api }         from '../../../api/client.js';

/* ── Carousel constants ─────────────────────────────────────────────────── */

const CAROUSEL_GAP    = 12;
const AUTOPLAY_DELAY  = 5000;
const PLACEHOLDER_COUNT = 4;

/** Slides per view at each breakpoint. */
const SPV_BREAKPOINTS = Object.freeze([
    { max: 640,  spv: 1 },
    { max: 1024, spv: 2 },
    { max: Infinity, spv: 4 },
]);

/* ── SVG icons ──────────────────────────────────────────────────────────── */

const ICON = Object.freeze({
    prev: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"
              aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`,

    next: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"
              aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`,
});

/* ══════════════════════════════════════════════════════════════════════════
   LandingBase  (abstract)
   ══════════════════════════════════════════════════════════════════════════ */

export class LandingBase extends Component {
    static styles       = '/pages/web/auth/_PublicLayout.css';
    static dependencies = ['/pages/web/auth/Landing.css'];

    constructor(props) {
        super(props);

        /* Carousel state */
        this._lcMount         = null;
        this._lcTotal         = 0;
        this._lcPage          = 0;
        this._lcTimer         = null;
        this._lcResizeHandler = null;
    }

    /* ── Subclass contract ────────────────────────────────────────────────── */

    /**
     * @returns {'north'|'central'|'south'|null}
     *   The region this landing page represents.
     *   Returns null on the neutral root landing.
     */
    get region() {
        return null;
    }

    /**
     * Subclasses MUST override this to return their hero / content markup.
     * @returns {string}
     */
    renderContent() {
        throw new Error(
            'LandingBase subclass must implement renderContent() — ' +
            'return the hero section HTML string.'
        );
    }

    /**
     * Optional hook fired after mount/load. Override to add page-specific
     * behaviour without duplicating the bootstrap dance.
     */
    onLandingReady() {
        /* no-op — subclasses may override */
    }

    /* ── Render ───────────────────────────────────────────────────────────── */

    render() {
        return PublicLayout.wrap({
            content: `
        <div id="landing-ads-mount"></div>
        ${this.renderContent()}
      `,
        });
    }

    /* ── Lifecycle ────────────────────────────────────────────────────────── */

    afterMount() {
        // Persist the region (if any) so the rest of the app personalises content
        if (this.region) {
            sessionStorage.setItem('adamawaRegion', this.region);
        }

        // Public layout bootstrap
        PublicLayout.mountLanguageSwitcher(this);
        PublicLayout.bindMobileMenu(this);
        PublicLayout.bindScroll(this);

        // Smooth-scroll for in-page anchors
        this.delegate('a[href^="#"]', 'click', (e, link) => {
            const id = link.getAttribute('href');
            if (id === '#') return;
            const target = this.$(id);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        });

        this._loadAds();
        this.onLandingReady();
    }

    beforeUnmount() {
        this._lcStopTimer();
        if (this._lcResizeHandler) {
            window.removeEventListener('resize', this._lcResizeHandler);
            this._lcResizeHandler = null;
        }
    }

    /* ── Ads loading ──────────────────────────────────────────────────────── */

    async _loadAds() {
        const res   = await api.adverts.getPublic();
        const mount = document.getElementById('landing-ads-mount');
        if (!mount) return;

        const ads = (!res.error && res.data?.length) ? res.data : [];

        if (!ads.length) {
            mount.innerHTML = `
        <div class="landing-carousel__static">
          ${Array.from({ length: PLACEHOLDER_COUNT }, () =>
                `<div class="landing-billboard landing-billboard--placeholder" aria-hidden="true"></div>`
            ).join('')}
        </div>
      `;
            return;
        }

        mount.innerHTML = this._buildCarouselHtml(ads);

        // Defer until the browser has painted and laid out the injected DOM
        requestAnimationFrame(() => requestAnimationFrame(() => {
            this._initCarousel(mount, ads);
        }));
    }

    /* ── Carousel — markup ────────────────────────────────────────────────── */

    _buildCarouselHtml(ads) {
        const cards = ads.map((ad) => this._buildBillboardCard(ad)).join('');
        return `
      <div class="landing-carousel" id="landing-carousel">
        <div class="landing-carousel__wrap">
          <div class="landing-carousel__viewport" id="lc-viewport">
            <div class="landing-carousel__track" id="lc-track">${cards}</div>
          </div>
          <button class="landing-carousel__btn landing-carousel__btn--prev"
                  id="lc-prev"
                  type="button"
                  aria-label="Previous ads">${ICON.prev}</button>
          <button class="landing-carousel__btn landing-carousel__btn--next"
                  id="lc-next"
                  type="button"
                  aria-label="Next ads">${ICON.next}</button>
        </div>
        <div class="landing-carousel__dots" id="lc-dots" role="tablist"></div>
      </div>
    `;
    }

    _buildBillboardCard(ad) {
        const hasOverlay = !ad.imageUrl || Boolean(ad.advertiser || ad.ctaLabel);
        const styleAttr  = ad.imageUrl
            ? ` style="--billboard-bg: url('${this.esc(ad.imageUrl)}')"`
            : '';
        const cls = `landing-billboard${ad.imageUrl ? '' : ' landing-billboard--no-img'}`;

        let inner = '';
        if (hasOverlay) {
            inner += `<div class="landing-billboard__overlay"></div>`;
            inner += `<div class="landing-billboard__content">`;
            if (ad.advertiser) {
                inner += `<span class="landing-billboard__advertiser">${this.esc(ad.advertiser)}</span>`;
            }
            inner += `<p class="landing-billboard__title">${this.esc(ad.title)}</p>`;
            if (ad.ctaLabel && ad.ctaUrl) {
                inner += `<span class="landing-billboard__cta">${this.esc(ad.ctaLabel)}</span>`;
            }
            inner += `</div>`;
        }

        return `
      <a class="${cls}"
         href="${this.esc(ad.ctaUrl || '#')}"
         target="_blank"
         rel="noopener noreferrer"
         data-ad-id="${ad.id}"
         aria-label="${this.esc(ad.title)}"${styleAttr}>${inner}</a>
    `;
    }

    /* ── Carousel — behaviour ─────────────────────────────────────────────── */

    _initCarousel(mount, ads) {
        this._lcMount = mount;
        this._lcTotal = ads.length;
        this._lcPage  = 0;

        this._lcSetLayout();
        this._lcRender();

        const prev     = mount.querySelector('#lc-prev');
        const next     = mount.querySelector('#lc-next');
        const carousel = mount.querySelector('#landing-carousel');

        if (prev) this.on(prev, 'click', () => { this._lcNav(-1); this._lcResetTimer(); });
        if (next) this.on(next, 'click', () => { this._lcNav(1);  this._lcResetTimer(); });

        if (carousel) {
            this.on(carousel, 'mouseenter', () => this._lcStopTimer());
            this.on(carousel, 'mouseleave', () => this._lcStartTimer());
        }

        this.on(mount, 'click', (e) => {
            const dot = e.target.closest('.lc-dot');
            if (dot) {
                this._lcPage = parseInt(dot.dataset.lcPage, 10);
                this._lcRender();
                this._lcResetTimer();
                return;
            }
            const adEl = e.target.closest('[data-ad-id]');
            if (adEl) api.adverts.recordClick(parseInt(adEl.dataset.adId, 10));
        });

        // Debounced resize
        let resizeRaf = null;
        this._lcResizeHandler = () => {
            if (resizeRaf) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(() => {
                this._lcSetLayout();
                this._lcPage = Math.min(this._lcPage, this._lcPageCount - 1);
                this._lcRender();
            });
        };
        window.addEventListener('resize', this._lcResizeHandler);

        this._lcStartTimer();
    }

    /** Returns slides-per-view based on the current viewport width. */
    _lcGetSpv() {
        const width = window.innerWidth;
        return SPV_BREAKPOINTS.find((bp) => width < bp.max).spv;
    }

    _lcSetLayout() {
        const mount    = this._lcMount;
        const viewport = mount?.querySelector('#lc-viewport');
        const track    = mount?.querySelector('#lc-track');
        if (!viewport || !track) return;

        // Fall back to carousel width if viewport hasn't laid out yet
        const vwRaw = viewport.offsetWidth
            || mount.querySelector('#landing-carousel')?.offsetWidth
            || 0;
        if (vwRaw === 0) return;

        const spv   = this._lcGetSpv();
        const cardW = Math.floor((vwRaw - CAROUSEL_GAP * (spv - 1)) / spv);

        this._lcCardW     = cardW;
        this._lcGap       = CAROUSEL_GAP;
        this._lcSpv       = spv;
        this._lcPageCount = Math.ceil(this._lcTotal / spv);

        track.querySelectorAll('.landing-billboard').forEach((c) => {
            c.style.width      = `${cardW}px`;
            c.style.flexShrink = '0';
        });

        track.style.width = `${(cardW + CAROUSEL_GAP) * this._lcTotal - CAROUSEL_GAP}px`;

        const dotsEl = mount.querySelector('#lc-dots');
        if (dotsEl) {
            dotsEl.innerHTML = this._lcPageCount > 1
                ? Array.from({ length: this._lcPageCount }, (_, i) => `
            <button class="lc-dot${i === this._lcPage ? ' lc-dot--active' : ''}"
                    type="button"
                    role="tab"
                    data-lc-page="${i}"
                    aria-label="Page ${i + 1}"
                    aria-selected="${i === this._lcPage}"></button>
          `).join('')
                : '';
        }

        const prev = mount.querySelector('#lc-prev');
        const next = mount.querySelector('#lc-next');
        if (prev) prev.style.display = this._lcPageCount > 1 ? '' : 'none';
        if (next) next.style.display = this._lcPageCount > 1 ? '' : 'none';
    }

    _lcRender() {
        const track = this._lcMount?.querySelector('#lc-track');
        if (!track) return;

        this._lcPage = Math.max(0, Math.min(this._lcPage, this._lcPageCount - 1));
        const offset = this._lcPage * this._lcSpv * (this._lcCardW + this._lcGap);
        track.style.transform = `translateX(-${offset}px)`;

        this._lcMount?.querySelectorAll('.lc-dot').forEach((d, i) => {
            const active = i === this._lcPage;
            d.classList.toggle('lc-dot--active', active);
            d.setAttribute('aria-selected', String(active));
        });
    }

    _lcNav(dir) {
        this._lcPage = (this._lcPage + dir + this._lcPageCount) % this._lcPageCount;
        this._lcRender();
    }

    _lcStartTimer() {
        if (this._lcPageCount <= 1) return;
        this._lcTimer = setInterval(() => this._lcNav(1), AUTOPLAY_DELAY);
    }

    _lcStopTimer() {
        if (this._lcTimer) {
            clearInterval(this._lcTimer);
            this._lcTimer = null;
        }
    }

    _lcResetTimer() {
        this._lcStopTimer();
        this._lcStartTimer();
    }
}