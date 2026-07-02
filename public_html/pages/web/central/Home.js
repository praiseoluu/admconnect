/**
 * KTG Connect — Home Feed Page
 * Route: /home
 * Guards: requireAuth + requireCitizen
 * ============================================================
 * Sections:
 *   1. Hero carousel   — top 3 news articles, auto-advances every 5s,
 *                        manual prev/next, click → /news/:slug
 *      Ad sidebar      — up to 2 ad cards beside the carousel
 *   2. Reels row       — horizontal scroll, prev/next arrows, ReelCard components
 *   3. Recent News     — 3 latest published news, NewsCard horizontal layout
 *      Community Chat  — online count, top contributors, Open Community Chat btn
 */

import { WebLayout } from '../../../components/layout/BaseLayout.js';
import { NewsCard } from '../../../components/base/Card.js';
import { ReelCard } from '../../../components/base/Card.js';
import { Avatar } from '../../../components/base/UI.js';
import { store, showToast, setPageLoading } from '../../../core/store.js';
import { router } from '../../../core/router.js';
import { api } from '../../../api/client.js';
import { timeAgo } from '../../../utils/date.js';
import { t } from '../../../core/i18n.js';

export default class HomePage extends WebLayout {
  static styles = '/pages/web/app/Home.css';

  constructor(props) {
    super({ title: t('home.title'), ...props });
    this._news = [];
    this._reels = [];
    this._adverts = [];
    this._contributors = [];
    this._onlineCount = 0;
    this._carouselIdx = 0;
    this._carouselTimer = null;
  }

  getContent() {
    return `<div class="home-page" id="home-root">${this._skeletonHtml()}</div>`;
  }

  async onContentReady() {
    setPageLoading(true);
    // Fire all requests in parallel
    const [newsRes, reelsRes, advertsRes, onlineRes] = await Promise.all([
      api.news.getForLGA({ perPage: 6 }),
      api.reels.getForLGA({ perPage: 8 }),
      api.adverts.getForLGA('banner'),
      api.chat.getOnlineCount(),
    ]);

    this._news = newsRes.data || [];
    this._reels = reelsRes.data || [];
    this._adverts = advertsRes.data || [];
    this._onlineCount = onlineRes.data?.count || 0;

    // Top contributors: approved posts sorted by likes desc, unique users, top 3
    // const allPosts = postsRes.data || [];
    // const byUser = {};
    // for (const p of allPosts) {
    //   if (p.status !== 'approved') continue;
    //   if (!byUser[p.userId]) byUser[p.userId] = { userId: p.userId, userName: p.userName, avatarUrl: p.avatarUrl || null, likes: 0, posts: 0 };
    //   byUser[p.userId].likes += p.likes || 0;
    //   byUser[p.userId].posts += 1;
    // }
    // this._contributors = Object.values(byUser)
    //   .sort((a, b) => b.likes - a.likes)
    //   .slice(0, 3);

    this._render();
    setPageLoading(false);
  }

  // ── Main render ───────────────────────────────────────────────────────

  _render() {
    const root = this.getContentEl()?.querySelector('#home-root');
    if (!root) return;

    const carouselNews = this._news.slice(0, 3);
    const recentNews = this._news.slice(0, 3);
    const user = store.currentUser;
    const lga = store.currentLGA;

    root.innerHTML = `

      <!-- ── Row 1: Carousel + Ads ── -->
      <div class="home-top-row${this._adverts.length === 0 ? ' home-top-row--no-ads' : ''}">

        <!-- Carousel -->
        <div class="home-carousel" id="home-carousel" aria-label="${this.esc(t('home.carouselLabel'))}" aria-roledescription="carousel">
          <div class="home-carousel__track" id="carousel-track">
            ${carouselNews.length ? carouselNews.map((item, i) => `
              <div class="home-carousel__slide ${i === 0 ? 'home-carousel__slide--active' : ''}"
                role="group" aria-roledescription="slide"
                aria-label="${this.esc(t('home.slideCounter', { current: i + 1, total: carouselNews.length }))}: ${this.esc(item.title)}"
                data-slide="${i}" data-slug="${this.esc(item.slug || item.id)}">
                ${item.imageUrl
        ? `<img class="home-carousel__img" src="${this.esc(item.imageUrl)}"
                      alt="${this.esc(item.title)}" loading="${i === 0 ? 'eager' : 'lazy'}" />`
        : `<div class="home-carousel__img-placeholder" aria-hidden="true"></div>`
    }
                <div class="home-carousel__overlay">
                  <div class="home-carousel__caption">
                    ${item.breaking ? `<span class="home-carousel__breaking">${this.esc(t('home.breaking'))}</span>` : ''}
                    <h2 class="home-carousel__title">${this.esc(item.title)}</h2>
                    <p class="home-carousel__meta">
                      ${this.esc(item.lgaName || lga?.name || '')}
                      · ${timeAgo(item.publishedAt)}
                    </p>
                  </div>
                </div>
              </div>
            `).join('') : `<div class="home-carousel__empty"><p>${this.esc(t('home.noNewsAvailable'))}</p></div>`}
          </div>

          <!-- Controls -->
          ${carouselNews.length > 1 ? `
            <button class="home-carousel__btn home-carousel__btn--prev" id="carousel-prev"
              type="button" aria-label="${this.esc(t('home.prevSlide'))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button class="home-carousel__btn home-carousel__btn--next" id="carousel-next"
              type="button" aria-label="${this.esc(t('home.nextSlide'))}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <div class="home-carousel__dots" role="tablist" aria-label="${this.esc(t('home.slideNav'))}">
              ${carouselNews.map((_, i) => `
                <button class="home-carousel__dot ${i === 0 ? 'home-carousel__dot--active' : ''}"
                  role="tab" aria-selected="${i === 0}" aria-label="${this.esc(t('home.slide', { n: i + 1 }))}"
                  data-dot="${i}" type="button"></button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Ad sidebar -->
          ${this._adverts.length > 0 ? `
        <div class="home-ads">
          ${this._adverts.slice(0, 2).map((ad) => `
            <div class="home-ad-card">
              ${ad.imageUrl
        ? `<img class="home-ad-card__img" src="${this.esc(ad.imageUrl)}"
                    alt="${this.esc(ad.title)}" loading="lazy" />`
        : `<div class="home-ad-card__img-placeholder" aria-hidden="true"></div>`
    }
              <div class="home-ad-card__body">
                <span class="home-ad-card__label">${this.esc(t('home.advertisement'))}</span>
                <p class="home-ad-card__title">${this.esc(ad.title)}</p>
                ${ad.description ? `<p class="home-ad-card__desc">${this.esc(ad.description)}</p>` : ''}
                ${ad.ctaLabel ? `
                  <a href="${this.esc(ad.ctaUrl || '#')}"
                    class="home-ad-card__cta" target="_blank" rel="noopener noreferrer">
                    ${this.esc(ad.ctaLabel)}
                  </a>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
          ` : ''}

      </div>

      <!-- ── Row 2: Reels ── -->
      ${this._reels.length ? `
        <section class="home-section" aria-labelledby="reels-heading">
          <div class="home-section__header">
            <h2 class="home-section__title" id="reels-heading">${this.esc(t('home.reels'))}</h2>
            <a href="/central/reels" class="home-section__link">${this.esc(t('home.seeAll'))}</a>
          </div>
          <div class="home-reels-wrap">
            <button class="home-reels__arrow home-reels__arrow--prev" id="reels-prev"
              type="button" aria-label="${this.esc(t('home.scrollReelsLeft'))}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div class="home-reels-scroll" id="reels-scroll" role="list"
              aria-label="${this.esc(t('home.reels'))}">
              <div class="home-reels-track" id="reels-track"></div>
            </div>
            <button class="home-reels__arrow home-reels__arrow--next" id="reels-next"
              type="button" aria-label="${this.esc(t('home.scrollReelsRight'))}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </section>
      ` : ''}

      <!-- ── Row 3: Recent News + Community Chat ── -->
      <div class="home-bottom-row">

        <!-- Recent News -->
        <section class="home-section home-section--news" aria-labelledby="news-heading">
          <div class="home-section__header">
            <h2 class="home-section__title" id="news-heading">${this.esc(t('home.recentNews'))}</h2>
            <a href="/central/news" class="home-section__link">${this.esc(t('home.seeAll'))}</a>
          </div>
          <div class="home-news-stack" id="news-stack">
            ${recentNews.length === 0
        ? `<div class="home-empty"><p>${this.esc(t('home.noNewsForLga', { lga: lga?.name || t('home.yourLga') }))}</p></div>`
        : ''
    }
          </div>
        </section>

        <!-- Community Chat -->
        <section class="home-section home-section--community" aria-labelledby="community-heading">
          <div class="home-section__header">
            <h2 class="home-section__title" id="community-heading">${this.esc(t('home.communityChat'))}</h2>
          </div>
          <div class="home-community-card">
            <div class="home-community__header">
              <div class="home-community__avatar-stack" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke="var(--color-primary)" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div>
                <p class="home-community__title">${this.esc(t('home.activeCommunity'))}</p>
                <p class="home-community__subtitle">
                  <span class="home-community__dot" aria-hidden="true"></span>
                  ${this.esc(t('home.membersOnline', { count: this._onlineCount }))}
                </p>
              </div>
            </div>

            <button class="home-community__cta" id="open-chat-btn" type="button">
              ${this.esc(t('home.openChat'))}
            </button>

            ${this._contributors.length ? `
              <div class="home-community__contributors">
                <p class="home-community__contributors-label">${this.esc(t('home.topContributors'))}</p>
                ${this._contributors.map((c) => `
                  <div class="home-community__contributor">
                    ${Avatar.html({ name: c.userName, imageUrl: c.avatarUrl, size: 'sm' })}
                    <span class="home-community__contributor-name">${this.esc(c.userName)}</span>
                    <span class="home-community__contributor-stat">${this.esc(t('home.likes', { count: c.likes }))}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </section>

      </div>
    `;

    this._mountReelCards();
    this._mountNewsCards(recentNews);
    this._bindCarousel(carouselNews.length);
    this._bindReelsScroll();
    this._bindChatBtn();
  }

  // ── Carousel ──────────────────────────────────────────────────────────

  _bindCarousel(total) {
    if (total < 2) return;
    const root = this.getContentEl();

    // Click on slide → navigate to article
    this.delegate('.home-carousel__slide', 'click', (e, slide) => {
      const slug = slide.dataset.slug;
      if (slug) router.push(`/central/news/${slug}`);
    });

    // Prev / Next buttons
    const prev = root?.querySelector('#carousel-prev');
    const next = root?.querySelector('#carousel-next');
    if (prev) this.on(prev, 'click', () => this._carouselStep(-1, total));
    if (next) this.on(next, 'click', () => this._carouselStep(1, total));

    // Dot navigation
    this.delegate('.home-carousel__dot', 'click', (e, dot) => {
      this._carouselGo(Number(dot.dataset.dot), total);
    });

    // Pause on hover
    const carousel = root?.querySelector('#home-carousel');
    if (carousel) {
      this.on(carousel, 'mouseenter', () => this._stopAutoplay());
      this.on(carousel, 'mouseleave', () => this._startAutoplay(total));
    }

    this._startAutoplay(total);
  }

  _startAutoplay(total) {
    this._stopAutoplay();
    this._carouselTimer = setInterval(() => this._carouselStep(1, total), 5000);
  }

  _stopAutoplay() {
    if (this._carouselTimer) { clearInterval(this._carouselTimer); this._carouselTimer = null; }
  }

  _carouselStep(dir, total) {
    this._carouselGo((this._carouselIdx + dir + total) % total, total);
  }

  _carouselGo(idx, total) {
    const root = this.getContentEl();
    const slides = root?.querySelectorAll('.home-carousel__slide');
    const dots = root?.querySelectorAll('.home-carousel__dot');
    if (!slides?.length) return;

    slides[this._carouselIdx]?.classList.remove('home-carousel__slide--active');
    dots?.[this._carouselIdx]?.classList.remove('home-carousel__dot--active');
    dots?.[this._carouselIdx]?.setAttribute('aria-selected', 'false');

    this._carouselIdx = idx;

    slides[idx]?.classList.add('home-carousel__slide--active');
    dots?.[idx]?.classList.add('home-carousel__dot--active');
    dots?.[idx]?.setAttribute('aria-selected', 'true');
  }

  // ── Reels ─────────────────────────────────────────────────────────────

  async _mountReelCards() {
    const track = this.getContentEl()?.querySelector('#reels-track');
    if (!track) return;
    for (const reel of this._reels) {
      const wrap = document.createElement('div');
      wrap.className = 'home-reel-wrap';
      track.appendChild(wrap);
      const card = this.addChild(new ReelCard({
        ...reel,
        onClick: () => router.push(`/central/reels/${reel.reelId}`),
      }));
      await card.mount(wrap);
    }
  }

  _bindReelsScroll() {
    const scroll = this.getContentEl()?.querySelector('#reels-scroll');
    const prev = this.getContentEl()?.querySelector('#reels-prev');
    const next = this.getContentEl()?.querySelector('#reels-next');
    const step = 300;
    if (prev && scroll) this.on(prev, 'click', () => scroll.scrollBy({ left: -step, behavior: 'smooth' }));
    if (next && scroll) this.on(next, 'click', () => scroll.scrollBy({ left: step, behavior: 'smooth' }));
  }

  // ── Recent News ───────────────────────────────────────────────────────

  async _mountNewsCards(items) {
    const stack = this.getContentEl()?.querySelector('#news-stack');
    if (!stack || !items.length) return;
    for (const item of items) {
      const wrap = document.createElement('div');
      stack.appendChild(wrap);
      const card = this.addChild(new NewsCard({
        ...item,
        layout: 'horizontal',
        onClick: () => router.push(`/central/news/${item.slug || item.id}`),
      }));
      await card.mount(wrap);
    }
  }

  // ── Community chat ────────────────────────────────────────────────────

  _bindChatBtn() {
    const btn = this.getContentEl()?.querySelector('#open-chat-btn');
    if (btn) this.on(btn, 'click', () => router.push('/central/chat'));
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  _skeletonHtml() {
    return `
      <div class="home-skeleton" aria-hidden="true">
        <div class="home-top-row">
          <div class="home-skeleton__carousel"></div>
          <div class="home-skeleton__ads">
            <div class="home-skeleton__ad"></div>
            <div class="home-skeleton__ad"></div>
          </div>
        </div>
        <div class="home-skeleton__section-title"></div>
        <div class="home-skeleton__reels">
          ${Array.from({ length: 4 }).map(() => `<div class="home-skeleton__reel"></div>`).join('')}
        </div>
        <div class="home-skeleton__section-title"></div>
        ${Array.from({ length: 3 }).map(() => `<div class="home-skeleton__news"></div>`).join('')}
      </div>
    `;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  beforeUnmount() {
    this._stopAutoplay();
  }
}
