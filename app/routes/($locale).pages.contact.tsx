/**
 * Contact Page — /pages/contact
 *
 * Editorial-style contact page with form and direct info.
 * The action handler records the submission; wire up an email
 * service (e.g. SendGrid, Resend) inside the `action` function
 * when ready.
 */
import type {Route} from './+types/pages.contact';
import {Form, useActionData, useNavigation} from 'react-router';

export const meta: Route.MetaFunction = () => [
  {title: 'TrendsByAfeez | Contact'},
  {
    name: 'description',
    content: 'Get in touch with TrendsByAfeez — we\'d love to hear from you.',
  },
];

interface ActionData {
  success?: boolean;
  error?: string;
}

export async function action({request}: Route.ActionArgs): Promise<ActionData> {
  const formData = await request.formData();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();

  // Basic server-side validation
  if (!name || !email || !message) {
    return {error: 'Please fill in all required fields.'};
  }

  // Simple email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {error: 'Please enter a valid email address.'};
  }

  // ── Integrate your email service here ───────────────────────────
  // Example using Resend, SendGrid, or Mailgun:
  //
  // await fetch('https://api.resend.com/emails', {
  //   method: 'POST',
  //   headers: {
  //     Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({
  //     from: 'contact@trendsbyafeez.com',
  //     to: 'hello@trendsbyafeez.com',
  //     subject: `Contact: ${subject || 'No subject'} (from ${name})`,
  //     text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
  //   }),
  // });
  // ────────────────────────────────────────────────────────────────

  // Suppress unused-variable warnings until email service is wired up
  void subject;

  return {success: true};
}

export default function ContactPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="contact-page">
      {/* ── Page header ─────────────────────────────────────── */}
      <header className="contact-page__header">
        <span className="contact-page__eyebrow">Get in touch</span>
        <h1 className="contact-page__title">Contact</h1>
      </header>

      <div className="contact-page__body">
        {/* ── Info column ───────────────────────────────────── */}
        <div className="contact-info">
          <div className="contact-info__section">
            <span className="contact-info__label">Email</span>
            <a
              className="contact-info__link"
              href="mailto:info@trendsbyafeez.com"
            >
              info@trendsbyafeez.com
            </a>
          </div>

          <div className="contact-info__section">
            <span className="contact-info__label">Response time</span>
            <p className="contact-info__value">
              We aim to respond within 1–2 business days.
            </p>
          </div>

          <div className="contact-info__section">
            <span className="contact-info__label">Follow us</span>
            <ul className="contact-info__social">
              <li className="contact-info__social-item">
                <a
                  href="https://instagram.com/trendsbyafeez"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  Instagram
                </a>
              </li>
              <li className="contact-info__social-item">
                <a
                  href="https://twitter.com/trendsbyafeez"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Twitter / X
                </a>
              </li>
              <li className="contact-info__social-item">
                <a
                  href="https://tiktok.com/@trendsbyafeez"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.93a8.16 8.16 0 004.77 1.52V7.01a4.85 4.85 0 01-1-.32z" />
                  </svg>
                  TikTok
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Form column ───────────────────────────────────── */}
        <div>
          {actionData?.success ? (
            <div className="contact-form__success" role="status">
              <p className="contact-form__success-title">Message received</p>
              <p className="contact-form__success-body">
                Thank you for reaching out. We&apos;ll get back to you within
                1–2 business days.
              </p>
            </div>
          ) : (
            <Form method="post" className="contact-form" noValidate>
              <div className="contact-form__row contact-form__row--two">
                <div className="contact-form__field">
                  <label className="contact-form__label" htmlFor="contact-name">
                    Name <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="contact-name"
                    className="contact-form__input"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="contact-form__field">
                  <label className="contact-form__label" htmlFor="contact-email">
                    Email <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="contact-email"
                    className="contact-form__input"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="contact-form__field">
                <label className="contact-form__label" htmlFor="contact-subject">
                  Subject
                </label>
                <input
                  id="contact-subject"
                  className="contact-form__input"
                  name="subject"
                  type="text"
                  placeholder="Order enquiry, collaboration, general…"
                  autoComplete="off"
                />
              </div>

              <div className="contact-form__field">
                <label className="contact-form__label" htmlFor="contact-message">
                  Message <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="contact-message"
                  className="contact-form__textarea"
                  name="message"
                  placeholder="Tell us how we can help…"
                  required
                />
              </div>

              {actionData?.error && (
                <p className="contact-form__error-msg" role="alert">
                  {actionData.error}
                </p>
              )}

              <button
                className="contact-form__submit"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending…' : 'Send Message'}
                {!isSubmitting && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 7h12M8 2l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
