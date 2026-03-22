/**
 * Cookie Policy Page — /pages/cookie-policy
 *
 * A standalone route with hardcoded cookie policy content.
 * Replace placeholder contact details with your actual info.
 */
import type {Route} from './+types/pages.cookie-policy';
import {Link} from 'react-router';

export const meta: Route.MetaFunction = () => [
  {title: 'TrendsByAfeez | Cookie Policy'},
  {
    name: 'description',
    content: 'Learn how TrendsByAfeez uses cookies and similar technologies on our website.',
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="policy-page">
      <Link to="/" className="policy-page__back" prefetch="intent">
        ← Back to Home
      </Link>

      <span className="policy-page__eyebrow">Legal</span>
      <h1 className="policy-page__title">Cookie Policy</h1>
      <span className="policy-page__date">Last updated: March 2026</span>

      <div className="policy-page__content">
        <h2>What Are Cookies?</h2>
        <p>
          Cookies are small text files placed on your device when you visit a website. They
          allow the site to remember your preferences and understand how you interact with
          our pages. Cookies do not contain personally identifiable information on their own.
        </p>

        <h2>How We Use Cookies</h2>
        <p>
          TrendsByAfeez uses cookies and similar technologies to operate our store, improve
          your experience, and understand site performance. We categorise these as follows:
        </p>

        <h3>1. Strictly Necessary Cookies</h3>
        <p>
          These cookies are essential for the website to function correctly. They enable core
          features such as page navigation, access to secure areas, and shopping cart functionality.
          The site cannot function properly without these cookies and they cannot be disabled.
        </p>
        <table>
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>_shopify_session</td>
              <td>Shopify session identifier — maintains your cart and session state</td>
              <td>Session</td>
            </tr>
            <tr>
              <td>_shopify_y</td>
              <td>Shopify anonymous visitor tracking</td>
              <td>1 year</td>
            </tr>
            <tr>
              <td>cart</td>
              <td>Stores your shopping cart contents between visits</td>
              <td>2 weeks</td>
            </tr>
            <tr>
              <td>secure_customer_sig</td>
              <td>Identifies logged-in customers securely</td>
              <td>20 years</td>
            </tr>
          </tbody>
        </table>

        <h3>2. Performance & Analytics Cookies</h3>
        <p>
          These cookies help us understand how visitors interact with our website by collecting
          and reporting information anonymously. This allows us to improve page performance and
          the overall shopping experience.
        </p>
        <table>
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>_shopify_s</td>
              <td>Shopify analytics — records session activity</td>
              <td>30 minutes</td>
            </tr>
            <tr>
              <td>_shopify_fs</td>
              <td>Shopify analytics — records first session</td>
              <td>2 years</td>
            </tr>
            <tr>
              <td>tba_cookie_consent</td>
              <td>Stores your cookie consent preference on this site</td>
              <td>Persistent (localStorage)</td>
            </tr>
          </tbody>
        </table>

        <h3>3. Marketing & Preference Cookies</h3>
        <p>
          These cookies remember choices you make (such as country/region or language) and
          provide enhanced, more personal features. They may also be used to provide
          advertising services that are more relevant to you and your interests.
        </p>
        <p>
          If you decline cookies via our consent banner, only strictly necessary cookies will
          be set. Marketing and analytics cookies will not be activated without your consent.
        </p>

        <h2>Your Choices</h2>
        <p>
          When you first visit our site, you will be shown a cookie consent banner. You can
          choose to accept all cookies or decline non-essential cookies. You can change your
          preference at any time by clearing your browser's local storage or cookies.
        </p>
        <p>
          You can also control cookies through your browser settings. Most browsers allow you
          to refuse or delete cookies. Please note that disabling cookies may affect website
          functionality, including your shopping cart.
        </p>

        <h2>Third-Party Cookies</h2>
        <p>
          We use Shopify to power our store. Shopify sets several cookies on our behalf to
          provide essential e-commerce functionality. Please refer to{' '}
          <a
            href="https://www.shopify.com/legal/cookies"
            target="_blank"
            rel="noopener noreferrer"
          >
            Shopify's Cookie Policy
          </a>{' '}
          for details on the cookies they set.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Cookie Policy periodically to reflect changes in technology,
          legislation, or our data practices. We will update the "Last updated" date at the
          top of this page when we make changes.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have any questions about our use of cookies, please{' '}
          <Link to="/pages/contact">contact us</Link> or review our{' '}
          <Link to="/policies/privacy-policy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
