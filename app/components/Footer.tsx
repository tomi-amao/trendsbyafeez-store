import {Suspense} from 'react';
import {Await, NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

function MarqueeDivider() {
  const text = 'IF YOU SAW ME \u00B7 I WAS NEVER HERE \u00B7 ';
  const repeated = Array(6).fill(text).join('');
  return (
    <div className="marquee-divider" aria-hidden="true">
      <div className="marquee-divider__track">
        <span className="marquee-divider__text">{repeated}</span>
        <span className="marquee-divider__text" aria-hidden="true">{repeated}</span>
      </div>
    </div>
  );
}

export function Footer({
  footer: footerPromise,
  header,
  publicStoreDomain,
}: FooterProps) {
  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {(footer) => (
          <footer className="footer">
            <div className="footer__grid">
              <div className="footer__brand">
                <h2>STAY LOCKED IN</h2>

                <p
                  style={{
                    fontSize: '0.8rem',
                    opacity: 0.7,
                    marginBottom: '1rem',
                    lineHeight: 1.6,
                  }}
                >
                  
                </p>
                <div className="footer__newsletter-form">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    aria-label="Email for newsletter"
                  />
                  <button type="button">Sign Up</button>
                </div>
              </div>
              <div className="footer__col">
                <h3>Shop</h3>
                <ul>
                  <li>
                    <NavLink prefetch="intent" to="/collections">
                      All Collections
                    </NavLink>
                  </li>
                  <li>
                    <NavLink prefetch="intent" to="/collections/all">
                      New Arrivals
                    </NavLink>
                  </li>
                  <li>
                    <NavLink prefetch="intent" to="/search">
                      Search
                    </NavLink>
                  </li>
                </ul>
              </div>
              <div className="footer__col">
                <h3>Help</h3>
                <FooterLinks
                  menu={footer?.menu}
                  primaryDomainUrl={header.shop.primaryDomain.url}
                  publicStoreDomain={publicStoreDomain}
                />
              </div>
              <div className="footer__col">
                <h3>Company</h3>
                <ul>
                  <li>
                    <NavLink prefetch="intent" to="/pages/about">
                      About
                    </NavLink>
                  </li>
                  <li>
                    <NavLink prefetch="intent" to="/pages/contact">
                      Contact
                    </NavLink>
                  </li>
                  <li>
                    <NavLink prefetch="intent" to="/account">
                      Account
                    </NavLink>
                  </li>
                </ul>
              </div>
              <div className="footer__col">
                <h3>Legal</h3>
                <ul>
                  <li>
                    <NavLink prefetch="intent" to="/policies/privacy-policy">
                      Privacy Policy
                    </NavLink>
                  </li>
                  <li>
                    <NavLink prefetch="intent" to="/pages/cookie-policy">
                      Cookie Policy
                    </NavLink>
                  </li>
                  <li>
                    <NavLink prefetch="intent" to="/policies/terms-of-service">
                      Terms of Service
                    </NavLink>
                  </li>
                  <li>
                    <NavLink prefetch="intent" to="/policies/refund-policy">
                      Refund Policy
                    </NavLink>
                  </li>
                </ul>
              </div>
            </div>
            <MarqueeDivider />

            <div className="footer__bottom">
              <span>
                &copy; {new Date().getFullYear()} {header.shop.name}. All rights
                reserved.
              </span>
              <div className="footer__bottom-links">
                <NavLink prefetch="intent" to="/policies/privacy-policy">
                  Privacy
                </NavLink>
                <NavLink prefetch="intent" to="/pages/cookie-policy">
                  Cookies
                </NavLink>
                <NavLink prefetch="intent" to="/pages/contact">
                  Contact
                </NavLink>
              </div>
            </div>
          </footer>
        )}
      </Await>
    </Suspense>
  );
}

function FooterLinks({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: FooterQuery['menu'] | undefined;
  primaryDomainUrl: string;
  publicStoreDomain: string;
}) {
  if (!menu) return null;
  return (
    <ul>
      {menu.items.map((item) => {
        if (!item.url) return null;
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        const isExternal = !url.startsWith('/');
        return (
          <li key={item.id}>
            {isExternal ? (
              <a href={url} rel="noopener noreferrer" target="_blank">
                {item.title}
              </a>
            ) : (
              <NavLink prefetch="intent" to={url}>
                {item.title}
              </NavLink>
            )}
          </li>
        );
      })}
    </ul>
  );
}
