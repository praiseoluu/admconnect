/**
 * ADMConnect — HTTP fetch helper
 * ============================================================
 * Shared by all citizen API modules.
 * Wraps fetch() and always returns { data } or { error }
 * — same contract as the old mock layer.
 */

import { showToast } from '../core/store.js';

// export const BASE_URL = 'http://localhost/server/api/v1';
export const BASE_URL = 'https://adamawakonect.com/server/api/v1';

function _token() {
  try {
    const auth = JSON.parse(sessionStorage.getItem('adm_auth') || 'null');
    return auth?.token || null;
  } catch {
    return null;
  }
}

// Debounce flag — prevents stacking identical maintenance toasts when multiple
// requests fire at once on a single page load.
let _maintenanceToastPending = false;

export async function _fetch(method, path, body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = _token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    const json = await res.json();

    if (json?.error?.code === 'MAINTENANCE') {
      const wasLoggedIn = !!_token();
      if (wasLoggedIn && !window.location.pathname.startsWith('/admin')) {
        // Wipe session and show the maintenance screen
        sessionStorage.removeItem('adm_auth');
        window.location.replace('/?maintenance=1');
        return json;
      }
      // Public/unauthenticated page — show a toast once per burst
      if (!_maintenanceToastPending) {
        _maintenanceToastPending = true;
        showToast('warning', 'ADMConnect is currently under maintenance. Please try again later.');
        setTimeout(() => { _maintenanceToastPending = false; }, 6000);
      }
    }

    return json;
  } catch (err) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server. Please check your connection.',
      },
    };
  }
}