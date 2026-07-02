/**
 * Adamawa Central Connect — Landing Page
 * ============================================================
 * Route: /central
 *
 * Landing page for the central senatorial zone.
 * Inherits all carousel, layout and bootstrap behaviour from
 * LandingBase — this file only owns the hero copy.
 *
 * @module  CentralLandingPage
 * @version 2.0.0
 */

import { LandingBase } from './_LandingBase.js';

export default class CentralLandingPage extends LandingBase {

  get region() { return 'central'; }

  renderContent() {
    return `
      <section class="landing__hero" aria-labelledby="hero-heading">
        <div class="landing__hero-inner">
          <div class="landing__hero-content">
            <h1 class="landing__hero-heading" id="hero-heading">
              Adamawa Central Connect
            </h1>
            <p class="rl-tagline">
              Your community platform for the central senatorial zone.
            </p>
          </div>
        </div>
      </section>
    `;
  }
}