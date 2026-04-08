/**
 * CookieBanner — Compact floating cookie consent UI.
 *
 * Three views:
 *  icon   – small floating FAB (bottom-left) shown after consent is given
 *  banner – slim bottom pill bar with reject/accept + gear icon
 *  modal  – preferences panel anchored bottom-left with toggle switches
 */
import {useEffect, useRef, useState, useCallback} from 'react';
import {Link} from 'react-router';
import {useAnalytics} from '@shopify/hydrogen';
import {Cookie} from '@phosphor-icons/react';

type ConsentPrefs = {
  personalization: boolean;
  marketing: boolean;
  analytics: boolean;
};

type View = 'none' | 'icon' | 'banner' | 'modal';

function readConsent(
  customerPrivacy: NonNullable<
    ReturnType<typeof useAnalytics>['customerPrivacy']
  >,
): ConsentPrefs {
  const c = customerPrivacy.currentVisitorConsent();
  return {
    personalization: c.preferences === true,
    marketing: c.marketing === true,
    analytics: c.analytics === true,
  };
}

function GearSvg({size = 18}: {size?: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function CategoryRow({
  label,
  badge,
  description,
  checked,
  disabled,
  onChange,
  defaultExpanded,
}: {
  label: string;
  badge?: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (val: boolean) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  return (
    <li className="cb-cat">
      <div className="cb-cat__row">
        <button
          type="button"
          className="cb-cat__expand"
          onClick={() => setExpanded((x) => !x)}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
        >
          {expanded ? '−' : '+'}
        </button>
        <div className="cb-cat__info">
          <span className="cb-cat__name">{label}</span>
          {badge && <span className="cb-cat__badge">{badge}</span>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          className={`cb-toggle${checked ? ' cb-toggle--on' : ''}${disabled ? ' cb-toggle--disabled' : ''}`}
          onClick={() => !disabled && onChange?.(!checked)}
          aria-label={`${label} cookies ${checked ? 'enabled' : 'disabled'}`}
        >
          <span className="cb-toggle__thumb" />
        </button>
      </div>
      {expanded && <p className="cb-cat__desc">{description}</p>}
    </li>
  );
}

export function CookieBanner() {
  const {register, customerPrivacy} = useAnalytics();
  const {ready} = register('CookieConsentBanner');
  const [view, setView] = useState<View>('none');
  const [prefs, setPrefs] = useState<ConsentPrefs>({
    personalization: false,
    marketing: false,
    analytics: false,
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (!customerPrivacy || initialized.current) return;
    initialized.current = true;
    if (customerPrivacy.shouldShowBanner()) {
      setPrefs(readConsent(customerPrivacy));
      const t = setTimeout(() => setView('icon'), 600);
      return () => clearTimeout(t);
    } else {
      ready();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPrivacy]);

  const applyConsent = useCallback(
    (marketing: boolean, analytics: boolean, preferences: boolean) => {
      if (!customerPrivacy) return;
      customerPrivacy.setTrackingConsent(
        {marketing, analytics, preferences, sale_of_data: marketing},
        () => ready(),
      );
      setView('none');
    },
    [customerPrivacy, ready],
  );

  const handleAcceptAll = useCallback(() => {
    setPrefs({personalization: true, marketing: true, analytics: true});
    applyConsent(true, true, true);
  }, [applyConsent]);

  const handleRejectAll = useCallback(() => {
    setPrefs({personalization: false, marketing: false, analytics: false});
    applyConsent(false, false, false);
  }, [applyConsent]);

  const handleSavePreferences = useCallback(() => {
    applyConsent(prefs.marketing, prefs.analytics, prefs.personalization);
  }, [applyConsent, prefs]);

  const openModal = useCallback(() => {
    if (customerPrivacy) setPrefs(readConsent(customerPrivacy));
    setView('modal');
  }, [customerPrivacy]);

  if (view === 'none') return null;

  return (
    <>
      {/* Floating icon FAB — post-consent minimised state */}
      {(view === 'icon' || view === 'banner') && (
        <button
          type="button"
          className={`cb-icon-fab${view === 'banner' ? ' cb-icon-fab--active' : ''}`}
          onClick={() => setView(view === 'banner' ? 'icon' : 'banner')}
          aria-label={view === 'banner' ? 'Close cookie banner' : 'Cookie preferences'}
          aria-expanded={view === 'banner'}
        >
          <Cookie size={22} weight="fill" aria-hidden="true" />
        </button>
      )}

      {/* Compact bottom bar */}
      {view === 'banner' && (
        <div
          className="cb-bar"
          role="region"
          aria-label="Cookie consent"
          aria-live="polite"
        >
          <div className="cb-bar__inner">
            <Cookie size={22} weight="fill" aria-hidden="true" />
            <div className="cb-bar__btns">
              <button
                type="button"
                className="cb-bar__btn"
                onClick={handleRejectAll}
              >
                Reject all
              </button>
              <button
                type="button"
                className="cb-bar__btn cb-bar__btn--accept"
                onClick={handleAcceptAll}
              >
                Accept cookies
              </button>
            </div>
            <button
              type="button"
              className="cb-bar__gear"
              onClick={openModal}
              aria-label="Cookie settings"
            >
              <GearSvg size={18} />
            </button>
          </div>
          <p className="cb-bar__text">
            We and our partners use cookies and other technologies to
            personalize your experience, show you ads, and perform analytics.
            See Our{' '}
            <Link to="/pages/cookie-policy" prefetch="intent">
              Cookie Policy
            </Link>
            .
          </p>
        </div>
      )}

      {/* Preferences modal — bottom-left panel */}
      {view === 'modal' && (
        <div
          className="cb-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Cookie preferences"
        >
          <div className="cb-modal__header">
            <h2 className="cb-modal__title">We use cookies</h2>
            <button
              type="button"
              className="cb-modal__close"
              onClick={() => setView('banner')}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <p className="cb-modal__desc">
            We and our partners use cookies and other technologies to
            personalize your experience, show you ads, and perform analytics.
            See Our{' '}
            <Link to="/pages/cookie-policy" prefetch="intent">
              Cookie Policy
            </Link>
            .
          </p>

          <p className="cb-modal__note">Save your preferences to close:</p>

          <div className="cb-modal__section">
            <p className="cb-modal__section-label">You allow:</p>
            <ul className="cb-cats">
              <CategoryRow
                label="Necessary"
                badge="Required"
                description="Necessary cookies are required to enable the basic features of this site, such as providing secure log-in or adjusting your consent preferences."
                checked={true}
                disabled={true}
                defaultExpanded={true}
              />
              <CategoryRow
                label="Performance & analytics"
                description="These cookies help us understand how you interact with the site and how we can improve. They track visits and traffic sources anonymously."
                checked={prefs.analytics}
                onChange={(val) =>
                  setPrefs((p) => ({...p, analytics: val, personalization: val}))
                }
              />
              <CategoryRow
                label="Marketing & Advertising"
                description="These cookies are used to make advertising more relevant to you. They track your activity across sites to deliver targeted ads."
                checked={prefs.marketing}
                onChange={(val) => setPrefs((p) => ({...p, marketing: val}))}
              />
            </ul>
          </div>

          <div className="cb-modal__footer">
            <Cookie size={18} weight="fill" aria-hidden="true" />
            <button
              type="button"
              className="cb-modal__btn"
              onClick={handleAcceptAll}
            >
              Accept cookies
            </button>
            <button
              type="button"
              className="cb-modal__btn cb-modal__btn--save"
              onClick={handleSavePreferences}
            >
              Save preferences
            </button>
          </div>
        </div>
      )}
    </>
  );
}

