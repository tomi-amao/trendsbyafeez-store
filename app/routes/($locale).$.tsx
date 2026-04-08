import type {Route} from './+types/$';
import {Link} from 'react-router';

export async function loader({request}: Route.LoaderArgs) {
  throw new Response(`${new URL(request.url).pathname} not found`, {
    status: 404,
  });
}

export default function CatchAllPage() {
  return null;
}

export function ErrorBoundary() {
  return (
    <div className="page-404">
      <span className="page-404__bg-num" aria-hidden="true">404</span>

      <p className="page-404__eyebrow">Error 404</p>
      <h1 className="page-404__title">Page Not Found</h1>
      <p className="page-404__body">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved. Check the URL or head back to explore.
      </p>
      <nav className="page-404__actions" aria-label="Recovery navigation">
        <Link to="/" className="page-404__link">
          Go Home
        </Link>
        <Link to="/collections" className="page-404__link page-404__link--ghost">
          Shop All
        </Link>
        <Link
          to="/pages/gallery"
          className="page-404__link page-404__link--ghost"
        >
          Gallery
        </Link>
      </nav>
    </div>
  );
}
