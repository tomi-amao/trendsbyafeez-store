import {Suspense, useEffect, useState} from 'react';
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

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu} = header;
  const location = useLocation();
  const isHome = location.pathname === '/' || Boolean(location.pathname.match(/^\/[a-z]{2}-[a-z]{2}\/?$/i));
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, {passive: true});
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const headerClass = `header ${isHome && !scrolled?'header--transparent':'header--solid'}`;

  return (
    <>
      <AnnouncementBar />
      <header className={headerClass}>
        <div className="header__left">
          <MobileMenuToggle />
          <DesktopNav menu={menu} primaryDomainUrl={shop.primaryDomain.url} publicStoreDomain={publicStoreDomain} />
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
  return (
    <div className="announcement-bar">
      <div className="announcement-bar__track">
        {[...Array(6)].map((_, i) => (
          <span className="announcement-bar__item" key={i}>
            <span>Free shipping on orders over $300</span>
            <span>&middot;</span>
            <NavLink to="/collections" prefetch="intent">Shop New Arrivals</NavLink>
            <span>&middot;</span>
            <span>New collection available now</span>
            <span>&middot;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DesktopNav({menu, primaryDomainUrl, publicStoreDomain}: {menu: HeaderProps['header']['menu']; primaryDomainUrl: string; publicStoreDomain: string}) {
  return (
    <nav className="header__nav">
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;
        const url = item.url.includes('myshopify.com') || item.url.includes(publicStoreDomain) || item.url.includes(primaryDomainUrl) ? new URL(item.url).pathname : item.url;
        return (<NavLink className="header__nav-link" key={item.id} prefetch="intent" to={url} end>{item.title}</NavLink>);
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

export function HeaderMenu({menu, primaryDomainUrl, viewport, publicStoreDomain}: {menu: HeaderProps['header']['menu']; primaryDomainUrl: string; viewport: 'desktop' | 'mobile'; publicStoreDomain: string}) {
  const {close} = useAside();
  if (viewport === 'mobile') {
    return (
      <nav className="header-menu-mobile" role="navigation">
        <NavLink end onClick={close} prefetch="intent" to="/">Home</NavLink>
        {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
          if (!item.url) return null;
          const url = item.url.includes('myshopify.com') || item.url.includes(publicStoreDomain) || item.url.includes(primaryDomainUrl) ? new URL(item.url).pathname : item.url;
          return (<NavLink key={item.id} end onClick={close} prefetch="intent" to={url}>{item.title}</NavLink>);
        })}
        <NavLink end onClick={close} prefetch="intent" to="/account">Account</NavLink>
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
