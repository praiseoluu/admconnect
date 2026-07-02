/**
 * Adamawa North Connect — Landing Page
 * ============================================================
 * Route: /north
 *
 * Landing page for the northern senatorial zone.
 * Inherits all carousel, layout and bootstrap behaviour from
 * LandingBase — this file only owns the hero copy.
 *
 * @module  NorthLandingPage
 * @version 2.0.0
 */

import { LandingBase } from './_LandingBase.js';

export default class NorthLandingPage extends LandingBase {

  get region() { return 'north'; }

  renderContent() {
    return `
      <section class="landing__hero" aria-labelledby="hero-heading">
        <div class="landing__hero-inner">
          <div class="landing__hero-content">
            <h1 class="landing__hero-heading" id="hero-heading">
              Adamawa North Connect
            </h1>
            <p class="rl-tagline">
              Your community platform for the northern senatorial zone.
            </p>
          </div>
        </div>
      </section>
    `;
  }
}