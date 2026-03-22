/**
 * CookieBanner — Fixed bottom consent banner.
 *
 * Stores the user's choice in localStorage under the key
 * `tba_cookie_consent` with values 'accepted' | 'declined'.
 * The banner is suppressed on subsequent visits once a choice is made.
 */
import {useEffect, useState} from 'react';
import {Link} from 'react-router';

type ConsentValue = 'accepted' | 'declined';
const STORAGE_KEY = 'tba_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show when no prior choice exists
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Small delay so the page renders first
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage may be blocked in some contexts
    }
  }, []);

  function saveConsent(value: ConsentValue) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div
      className={`cookie-banner${visible ? ' cookie-banner--visible' : ''}`}
      role="region"
      aria-label="Cookie consent"
      aria-live="polite"
    >
      <div className="cookie-banner__inner">
        <div className="cookie-banner__text">
          <p className="cookie-banner__title">We use cookies</p>
          <p className="cookie-banner__body">
            We use cookies to enhance your browsing experience and understand how
            you use our site.{' '}
            <Link to="/pages/cookie-policy" prefetch="intent">
              Cookie Policy
            </Link>{' '}
            &mdash;{' '}
            <Link to="/policies/privacy-policy" prefetch="intent">
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="cookie-banner__actions">
          <button
            className="cookie-banner__btn"
            onClick={() => saveConsent('declined')}
            type="button"
          >
            Decline
          </button>
          <button
            className="cookie-banner__btn cookie-banner__btn--accept"
            onClick={() => saveConsent('accepted')}
            type="button"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
