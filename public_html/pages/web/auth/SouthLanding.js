/**
 * Adamawa South Connect — Landing Page
 * ============================================================
 * Route: /south
 *
 * Landing page for the southern senatorial zone.
 * Inherits all carousel, layout and bootstrap behaviour from
 * LandingBase — this file only owns the hero copy.
 *
 * @module  SouthLandingPage
 * @version 2.0.0
 */

import { LandingBase } from './_LandingBase.js';

export default class SouthLandingPage extends LandingBase {

  get region() { return 'south'; }

  renderContent() {
    return `
      <section class="landing__hero" aria-labelledby="hero-heading">
        <div class="landing__hero-inner">
          <div class="landing__hero-content">
            <h1 class="landing__hero-heading" id="hero-heading">
              Adamawa South Connect
            </h1>
            <p class="rl-tagline">
              Your community platform for the southern senatorial zone.
            </p>
          </div>
        </div>
      </section>
    `;
  }
}