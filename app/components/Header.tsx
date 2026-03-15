import {Suspense, useEffect, useState, useRef} from 'react';
import {Await, NavLink, useAsyncValue, useLocation} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

// Timezone config: [label, IANA timezone]
const TIMEZONES = [
  ['Paris', 'Europe/Paris'],
  ['Johannesburg', 'Africa/Johannesburg'],
  ['Dubai', 'Asia/Dubai'],
  ['London', 'Europe/London'],
  ['Tokyo', 'Asia/Tokyo'],
] as const;

function useTimezoneClocks() {
  const [times, setTimes] = useState<string[]>([]);

  useEffect(() => {
    const formatTime = () =>
      TIMEZONES.map(([, tz]) =>
        new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date()),
      );
    setTimes(formatTime());
    const id = setInterval(() => setTimes(formatTime()), 30_000);
    return () => clearInterval(id);
  }, []);

  return times;
}

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu} = header;
  const location = useLocation();
  const isHome =
    location.pathname === '/' ||
    Boolean(location.pathname.match(/^\/[a-z]{2}-[a-z]{2}\/?$/i));

  // Smart scroll: transparent on home at top; hidden when scrolling down; solid when scrolling up
  const [headerState, setHeaderState] = useState<'top' | 'solid' | 'hidden'>('top');
  const lastScrollY = useRef(0);

  useEffect(() => {
    const ANNOUNCEMENT_H = 36; // matches --announcement-height in CSS
    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // Slide header up to top:0 as announcement bar scrolls away
      const newTop = Math.max(0, ANNOUNCEMENT_H - currentY);
      document.documentElement.style.setProperty('--header-top', `${newTop}px`);

      if (currentY < 80) {
        setHeaderState('top');
      } else if (delta > 4) {
        // Scrolling down
        setHeaderState('hidden');
      } else if (delta < -4) {
        // Scrolling up
        setHeaderState('solid');
      }
    };
    window.addEventListener('scroll', handleScroll, {passive: true});
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Expose header state for CSS-driven sticky adjustments
  useEffect(() => {
    document.documentElement.dataset.headerState = headerState;
    return () => {
      delete document.documentElement.dataset.headerState;
    };
  }, [headerState]);

  const headerClass = [
    'header',
    isHome && headerState === 'top' ? 'header--transparent' : 'header--solid',
    headerState === 'hidden' ? 'header--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <AnnouncementBar />
      <header className={headerClass}>
        <div className="header__left">
          <MobileMenuToggle />
          <DesktopNav
            menu={menu}
            primaryDomainUrl={shop.primaryDomain.url}
            publicStoreDomain={publicStoreDomain}
          />
        </div>
        <div className="header__center">
          <NavLink prefetch="intent" to="/" end>
            <span className="header__logo">{shop.name}</span>
          </NavLink>
        </div>
        <div className="header__right">
          <SearchToggle />
          <CartToggle cart={cart} />
        </div>
      </header>
    </>
  );
}

function AnnouncementBar() {
  const times = useTimezoneClocks();

  const items = TIMEZONES.map(([label], i) => (
    <span className="announcement-bar__item" key={label}>
      <span className="announcement-bar__dot" aria-hidden="true" />
      <span className="announcement-bar__city">{label}</span>
      <span className="announcement-bar__sep" aria-hidden="true" />
      <span className="announcement-bar__time">{times[i] ?? '--:--'}</span>
    </span>
  ));

  return (
    <div className="announcement-bar">
      <div className="announcement-bar__track">
        {/* Duplicate for seamless loop */}
        {items}
        {items}
      </div>
    </div>
  );
}

function DesktopNav({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: string;
  publicStoreDomain: string;
}) {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close submenu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resolveUrl = (url: string) =>
    url.includes('myshopify.com') ||
    url.includes(publicStoreDomain) ||
    url.includes(primaryDomainUrl)
      ? new URL(url).pathname
      : url;

  return (
    <nav className="header__nav" ref={navRef}>
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;
        const url = resolveUrl(item.url);
        const hasSubmenu = item.items && item.items.length > 0;
        const isOpen = openSubmenu === item.id;

        if (hasSubmenu) {
          return (
            <div
              key={item.id}
              className={`header__nav-item header__nav-item--has-submenu${isOpen ? ' header__nav-item--open' : ''}`}
            >
              <button
                className="header__nav-link header__nav-link--btn"
                onClick={() => setOpenSubmenu(isOpen ? null : item.id)}
                aria-expanded={isOpen}
                aria-haspopup="true"
              >
                {item.title}
                <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{marginLeft: '4px', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none'}}>
                  <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {isOpen && (
                <div className="header__submenu" role="menu">
                  <NavLink
                    className="header__submenu-link"
                    to={url}
                    prefetch="intent"
                    onClick={() => setOpenSubmenu(null)}
                    role="menuitem"
                  >
                    All {item.title}
                  </NavLink>
                  {item.items!.map((sub) => {
                    if (!sub.url) return null;
                    const subUrl = resolveUrl(sub.url);
                    return (
                      <NavLink
                        key={sub.id}
                        className="header__submenu-link"
                        to={subUrl}
                        prefetch="intent"
                        onClick={() => setOpenSubmenu(null)}
                        role="menuitem"
                      >
                        {sub.title}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <NavLink
            className="header__nav-link"
            key={item.id}
            prefetch="intent"
            to={url}
            end
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

function MobileMenuToggle() {
  const {open} = useAside();
  return (
    <button className="header__icon-btn header__mobile-toggle" onClick={() => open('mobile')} aria-label="Open menu">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/></svg>
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button className="header__icon-btn" onClick={() => open('search')} aria-label="Search">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="9" r="5.5"/><line x1="13.5" y1="13.5" x2="17" y2="17"/></svg>
    </button>
  );
}

function CartBadge({count}: {count: number}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();
  return (
    <button className="header__icon-btn" onClick={() => { open('cart'); publish('cart_viewed', {cart, prevCart, shop, url: window.location.href || ''} as CartViewPayload); }} aria-label={`Cart (${count} items)`}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 7h10l-1 8H6L5 7z"/><path d="M8 7V5a2 2 0 0 1 4 0v2"/></svg>
      {count > 0 && <span className="header__cart-count">{count}</span>}
    </button>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (<Suspense fallback={<CartBadge count={0} />}><Await resolve={cart}><CartBanner /></Await></Suspense>);
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: string;
  viewport: 'desktop' | 'mobile';
  publicStoreDomain: string;
}) {
  const {close} = useAside();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  const resolveUrl = (url: string) =>
    url.includes('myshopify.com') ||
    url.includes(publicStoreDomain) ||
    url.includes(primaryDomainUrl)
      ? new URL(url).pathname
      : url;

  if (viewport === 'mobile') {
    const items = (menu || FALLBACK_HEADER_MENU).items;
    const hasHomeLink = items.some(
      (item) => item.url && resolveUrl(item.url) === '/',
    );

    return (
      <nav className="header-menu-mobile" role="navigation">
        {!hasHomeLink && (
          <NavLink end onClick={close} prefetch="intent" to="/">
            Home
          </NavLink>
        )}
        {items.map((item) => {
          if (!item.url) return null;
          const url = resolveUrl(item.url);
          const hasSubmenu = item.items && item.items.length > 0;
          const isOpen = openSubmenu === item.id;

          if (hasSubmenu) {
            return (
              <div key={item.id} className="mobile-menu-item">
                <button
                  className="mobile-menu-item__toggle"
                  onClick={() => setOpenSubmenu(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                >
                  {item.title}
                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    style={{transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none'}}
                  >
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="mobile-submenu">
                    <NavLink
                      to={url}
                      prefetch="intent"
                      onClick={close}
                      className="mobile-submenu__link mobile-submenu__link--all"
                    >
                      All {item.title}
                    </NavLink>
                    {item.items!.map((sub) => {
                      if (!sub.url) return null;
                      const subUrl = resolveUrl(sub.url);
                      return (
                        <NavLink
                          key={sub.id}
                          to={subUrl}
                          prefetch="intent"
                          onClick={close}
                          className="mobile-submenu__link"
                        >
                          {sub.title}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink key={item.id} end onClick={close} prefetch="intent" to={url}>
              {item.title}
            </NavLink>
          );
        })}
        <NavLink end onClick={close} prefetch="intent" to="/account">
          Account
        </NavLink>
      </nav>
    );
  }
  return null;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {id: 'gid://shopify/MenuItem/461609500728', resourceId: null, tags: [], title: 'Collections', type: 'HTTP', url: '/collections', items: []},
    {id: 'gid://shopify/MenuItem/461609533496', resourceId: null, tags: [], title: 'Blog', type: 'HTTP', url: '/blogs/journal', items: []},
    {id: 'gid://shopify/MenuItem/461609566264', resourceId: null, tags: [], title: 'Policies', type: 'HTTP', url: '/policies', items: []},
    {id: 'gid://shopify/MenuItem/461609599032', resourceId: 'gid://shopify/Page/105312206904', tags: [], title: 'About', type: 'PAGE', url: '/pages/about', items: []},
  ],
};
