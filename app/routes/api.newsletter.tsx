/**
 * Newsletter subscription resource route — /api/newsletter
 *
 * Accepts POST { email, tags? } and subscribes the address to the configured
 * Mailchimp audience using the Marketing API.
 *
 * Required environment variables (set in Oxygen / .env):
 *   MAILCHIMP_API_KEY     — e.g.  abc123def456-us21
 *   MAILCHIMP_AUDIENCE_ID — the List ID from Mailchimp › Audience › Settings
 *
 * Optional request field:
 *   tags  — comma-separated tags applied to the new subscriber
 *            e.g.  "footer-signup, website, ss26"
 */
import {data} from 'react-router';
import type {ActionFunctionArgs} from 'react-router';

export async function action({request, context}: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return data({success: false, error: 'Method not allowed'}, {status: 405});
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  // Optional comma-separated tags sent by the form, e.g. "footer-signup, website"
  const tags = String(formData.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  // Server-side email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return data(
      {success: false, error: 'Please enter a valid email address.'},
      {status: 400},
    );
  }

  const env = (context as any).env as {
    MAILCHIMP_API_KEY?: string;
    MAILCHIMP_AUDIENCE_ID?: string;
  };

  const apiKey = env.MAILCHIMP_API_KEY;
  const audienceId = env.MAILCHIMP_AUDIENCE_ID;

  if (!apiKey || !audienceId) {
    // Env vars not yet configured — log server-side but don't break the UX
    console.error(
      '[newsletter] MAILCHIMP_API_KEY or MAILCHIMP_AUDIENCE_ID is not set',
    );
    return data({success: true});
  }

  // The data center (dc) is the suffix after the last '-' in the API key
  // e.g. "abc123-us21" → dc = "us21"
  const dc = apiKey.split('-').pop();

  try {
    const response = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members`,
      {
        method: 'POST',
        headers: {
          // Basic auth — username is arbitrary, password is the API key
          Authorization: `Basic ${btoa(`hydrogen:${apiKey}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email_address: email,
          // "pending" triggers the double opt-in confirmation email —
          // change to "subscribed" if you want single opt-in
          status: 'subscribed',
          // Tags to apply to this contact (empty array = no tags)
          tags,
        }),
      },
    );

    if (response.ok) {
      return data({success: true});
    }

    const result = (await response.json()) as {title?: string; detail?: string};

    if (result.title === 'Member Exists') {
      return data({
        success: false,
        error: "You're already subscribed — thank you!",
      });
    }

    console.error('[newsletter] Mailchimp API error:', result);
    // Surface Mailchimp's own detail message so the user knows exactly what went wrong
    // (e.g. "looks fake or invalid", "Please provide a valid email address.")
    const userMessage = result.detail ?? 'Something went wrong. Please try again.';
    return data(
      {success: false, error: userMessage},
      {status: 500},
    );
  } catch (err) {
    console.error('[newsletter] Mailchimp fetch error:', err);
    return data(
      {success: false, error: 'Something went wrong. Please try again.'},
      {status: 500},
    );
  }
}
