/**
 * CookieBanner — Fixed bottom consent banner with granular preferences modal.
 *
 * Matches the feature set of Shopify's native privacy banner:
 *   - Accept / Decline all from the bottom bar
 *   - "Manage preferences" opens a modal with per-category checkboxes
 *     (Required/Personalization/Marketing/Analytics) + "Save my choices"
 *   - Pre-populates checkboxes from `currentVisitorConsent()` on every open
 *
 * Integrates with Shopify's Customer Privacy API via Hydrogen's
 * `useAnalytics()` hook so analytics events are gated on consent.
 */
import {useEffect, useRef, useState, useCallback} from 'react';
import {Link} from 'react-router';
import {useAnalytics} from '@shopify/hydrogen';

type ConsentPrefs = {
  personalization: boolean;
  marketing: boolean;
  analytics: boolean;
};

function readConsent(customerPrivacy: NonNullable<ReturnType<typeof useAnalytics>['customerPrivacy']>): ConsentPrefs {
  const c = customerPrivacy.currentVisitorConsent();
  return {
    personalization: c.preferences === true,
    marketing: c.marketing === true,
    analytics: c.analytics === true,
  };
}

export function CookieBanner() {
  const {register, customerPrivacy} = useAnalytics();
  const {ready} = register('CookieConsentBanner');
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPrefs>({
    personalization: false,
    marketing: false,
    analytics: false,
  });

  // Prevent effect from re-firing when customerPrivacy identity changes each render
  const initialized = useRef(false);

  useEffect(() => {
    if (!customerPrivacy || initialized.current) return;
    initialized.current = true;
    if (customerPrivacy.shouldShowBanner()) {
      setPrefs(readConsent(customerPrivacy));
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    } else {
      ready();
    }
  // ready() is stable; customerPrivacy identity may change but we only init once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPrivacy]);

  const applyConsent = useCallback(
    (marketing: boolean, analytics: boolean, preferences: boolean) => {
      if (!customerPrivacy) return;
      customerPrivacy.setTrackingConsent(
        {marketing, analytics, preferences, sale_of_data: marketing},
        () => ready(),
      );
      setVisible(false);
      setShowPreferences(false);
    },
    [customerPrivacy, ready],
  );

  const handleAcceptAll = useCallback(() => {
    setPrefs({personalization: true, marketing: true, analytics: true});
    applyConsent(true, true, true);
  }, [applyConsent]);

  const handleDeclineAll = useCallback(() => {
    setPrefs({personalization: false, marketing: false, analytics: false});
    applyConsent(false, false, false);
  }, [applyConsent]);

  const handleSaveChoices = useCallback(() => {
    applyConsent(prefs.marketing, prefs.analytics, prefs.personalization);
  }, [applyConsent, prefs]);

  const openPreferences = useCallback(() => {
    if (customerPrivacy) setPrefs(readConsent(customerPrivacy));
    setShowPreferences(true);
  }, [customerPrivacy]);

  return (
    <>
      {/* ── Bottom bar ─────────────────────────────────────────────── */}
      <div
        className={`cookie-banner${visible ? ' cookie-banner--visible' : ''}`}
        role="region"
        aria-label="Cookie consent"
        aria-live="polite"
      >
        <div className="cookie-banner__inner">
          <div className="cookie-banner__text">
            <p className="cookie-banner__title">Cookie consent</p>
            <p className="cookie-banner__body">
              We and our partners, including Shopify, use cookies and other
              technologies to personalize your experience, show you ads, and
              perform analytics, and we will not use cookies or other
              technologies for these purposes unless you accept them. Learn
              more in our{' '}
              <Link to="/policies/privacy-policy" prefetch="intent">
                Privacy Policy
              </Link>
            </p>
          </div>
          <div className="cookie-banner__actions">
            <button
              className="cookie-banner__btn cookie-banner__btn--manage"
              onClick={openPreferences}
              type="button"
            >
              Manage preferences
            </button>
            <button
              className="cookie-banner__btn"
              onClick={handleDeclineAll}
              type="button"
            >
              Decline
            </button>
            <button
              className="cookie-banner__btn cookie-banner__btn--accept"
              onClick={handleAcceptAll}
              type="button"
            >
              Accept
            </button>
          </div>
        </div>
      </div>

      {/* ── Preferences modal ──────────────────────────────────────── */}
      {showPreferences && (
        <div
          className="cookie-prefs-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Cookie and privacy preferences"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPreferences(false);
          }}
        >
          <div className="cookie-prefs-panel">
            {/* Header */}
            <div className="cookie-prefs-header">
              <h2 className="cookie-prefs-title">
                Cookie and privacy preferences
              </h2>
              <div className="cookie-prefs-header-actions">
                <button
                  className="cookie-banner__btn cookie-banner__btn--accept"
                  onClick={handleAcceptAll}
                  type="button"
                >
                  Accept all
                </button>
                <button
                  className="cookie-banner__btn"
                  onClick={handleDeclineAll}
                  type="button"
                >
                  Decline all
                </button>
                <button
                  className="cookie-banner__btn cookie-banner__btn--save"
                  onClick={handleSaveChoices}
                  type="button"
                >
                  Save my choices
                </button>
                <button
                  className="cookie-prefs-close"
                  onClick={() => setShowPreferences(false)}
                  type="button"
                  aria-label="Close preferences"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Intro */}
            <div className="cookie-prefs-intro">
              <p className="cookie-prefs-intro-heading">You control your data</p>
              <p className="cookie-prefs-intro-body">
                Learn more about the cookies we use, and choose which cookies to
                allow.
              </p>
            </div>

            <hr className="cookie-prefs-divider" />

            {/* Categories */}
            <ul className="cookie-prefs-categories">
              {/* Required — always on, non-interactive */}
              <li className="cookie-prefs-category">
                <label className="cookie-prefs-category-label cookie-prefs-category-label--disabled">
                  <span className="cookie-prefs-checkbox-wrap">
                    <input type="checkbox" checked readOnly disabled />
                  </span>
                  <div className="cookie-prefs-category-text">
                    <span className="cookie-prefs-category-name">Required</span>
                    <span className="cookie-prefs-category-desc">
                      These cookies are necessary for the site to function
                      properly, including capabilities like logging in and adding
                      items to the cart.
                    </span>
                  </div>
                </label>
              </li>

              {/* Personalization → preferences */}
              <li className="cookie-prefs-category">
                <label className="cookie-prefs-category-label">
                  <span className="cookie-prefs-checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={prefs.personalization}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          personalization: e.target.checked,
                        }))
                      }
                    />
                  </span>
                  <div className="cookie-prefs-category-text">
                    <span className="cookie-prefs-category-name">
                      Personalization
                    </span>
                    <span className="cookie-prefs-category-desc">
                      These cookies store details about your actions to
                      personalize your next visit to the website.
                    </span>
                  </div>
                </label>
              </li>

              {/* Marketing */}
              <li className="cookie-prefs-category">
                <label className="cookie-prefs-category-label">
                  <span className="cookie-prefs-checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={prefs.marketing}
                      onChange={(e) =>
                        setPrefs((p) => ({...p, marketing: e.target.checked}))
                      }
                    />
                  </span>
                  <div className="cookie-prefs-category-text">
                    <span className="cookie-prefs-category-name">Marketing</span>
                    <span className="cookie-prefs-category-desc">
                      These cookies are used by us and our partners, including
                      Shopify, to optimize marketing communications and show you
                      ads on other websites.
                    </span>
                  </div>
                </label>
              </li>

              {/* Analytics */}
              <li className="cookie-prefs-category">
                <label className="cookie-prefs-category-label">
                  <span className="cookie-prefs-checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={prefs.analytics}
                      onChange={(e) =>
                        setPrefs((p) => ({...p, analytics: e.target.checked}))
                      }
                    />
                  </span>
                  <div className="cookie-prefs-category-text">
                    <span className="cookie-prefs-category-name">Analytics</span>
                    <span className="cookie-prefs-category-desc">
                      These cookies help us understand how you interact with the
                      site. We use this data to identify areas to improve.
                    </span>
                  </div>
                </label>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

