import {data} from 'react-router';
import type {LoaderFunctionArgs} from 'react-router';

/**
 * API endpoint to serve app configuration including the drop date countdown.
 * Reads from the DROP_DATE environment variable (ISO format: 2026-04-09T18:00:00)
 */
export async function loader({context}: LoaderFunctionArgs) {
  const env = (context as any).env as Record<string, string | undefined>;
  const dropDate = env?.DROP_DATE || '2026-04-15T00:00:00';

  return data({dropDate});
}
