/**
 * Gallery Archive Route — /pages/gallery/:archive
 *
 * Displays all photos for a specific archive, with lightbox,
 * back navigation, and links to explore other archives.
 *
 * TRENDSBYFACES — standard masonry grid (many images)
 * INCOGNITO     — editorial cinematic layout (~5 images)
 */
import type {Route} from './+types/pages.gallery.$archive';
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useLoaderData, Link} from 'react-router';
import {getAdminAccessToken, fetchAdminFiles} from '~/utils/shopify-admin.server';

export const meta: Route.MetaFunction = ({data}: {data: Awaited<ReturnType<typeof loader>> | undefined}) => [
  {title: `TrendsByAfeez | Gallery — ${data?.archiveName ?? ''}`},
  {name: 'description', content: `Editorial photographs from the ${data?.archiveName ?? ''} archive.`},
];

/* ─── Types ──────────────────────────────────────────────────────── */
interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

interface Archive {
  name: string;
  slug: string;
  images: GalleryImage[];
}

/* Map slugs to their file prefix + display name */
const ARCHIVE_CONFIG: Record<string, {prefix: string; name: string}> = {
  trendsbyfaces: {prefix: 'TRENDSBYFACES_', name: 'TrendsByFaces'},
  incognito: {prefix: 'INCOGNITO_', name: 'Incognito'},
};

/* ─── Grid span helper (for TRENDSBYFACES masonry) ───────────────── */
function getItemSpan(idx: number): React.CSSProperties {
  if (idx === 0) return {gridColumn: 'span 2', gridRow: 'span 2'};
  const c = (idx - 1) % 7;
  if (c === 3) return {gridColumn: 'span 2'};
  if (c === 5) return {gridRow: 'span 2'};
  return {};
}

/* ─── Loader ─────────────────────────────────────────────────────── */
export async function loader({context, params}: Route.LoaderArgs) {
  const archiveSlug = (params.archive ?? '').toLowerCase();
  const config = ARCHIVE_CONFIG[archiveSlug];
  const env = (context as any).env as Record<string, string | undefined>;
  const clientId = env?.SHOPIFY_CLIENT_ID;
  const clientSecret = env?.SHOPIFY_CLIENT_SECRET;
  const storeDomain = env?.PUBLIC_STORE_DOMAIN;

  const empty = {archive: null as Archive | null, otherArchives: [] as Archive[], archiveName: config?.name ?? archiveSlug};

  if (!config || !clientId || !clientSecret || !storeDomain) return empty;

  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(storeDomain, clientId, clientSecret);
  } catch {
    return empty;
  }

  try {
    // Fetch images for the current archive + all other archives in parallel
    const otherSlugs = Object.keys(ARCHIVE_CONFIG).filter((s) => s !== archiveSlug);
    const fetchPromises = [
      fetchAdminFiles(storeDomain, adminToken, {filenamePrefix: config.prefix, limit: 250}),
      ...otherSlugs.map((s) =>
        fetchAdminFiles(storeDomain, adminToken, {filenamePrefix: ARCHIVE_CONFIG[s].prefix, limit: 250}),
      ),
    ];

    const results = await Promise.all(fetchPromises);

    const toImages = (files: Awaited<ReturnType<typeof fetchAdminFiles>>): GalleryImage[] =>
      files
        .filter((f) => f.image !== null)
        .map((f) => ({id: f.id, url: f.image!.url, alt: f.alt, width: f.image!.width, height: f.image!.height}));

    const archive: Archive = {name: config.name, slug: archiveSlug, images: toImages(results[0])};

    const otherArchives: Archive[] = otherSlugs
      .map((s, i) => ({name: ARCHIVE_CONFIG[s].name, slug: s, images: toImages(results[i + 1])}))
      .filter((a) => a.images.length > 0);

    return {archive: archive.images.length > 0 ? archive : null, otherArchives, archiveName: config.name};
  } catch {
    return empty;
  }
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function GalleryArchivePage() {
  const {archive, otherArchives, archiveName} = useLoaderData<typeof loader>();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchStartX = useRef(0);

  const images = archive?.images ?? [];
  const lbImg = lightbox != null ? images[lightbox] : null;
  const isIncognito = archive?.slug === 'incognito';

  /* ── lightbox helpers ─────────────────────────────────────────── */
  const openLightbox = useCallback((idx: number) => {
    setLightbox(idx);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    document.body.style.overflow = '';
  }, []);

  const lbPrev = useCallback(() => {
    setLightbox((i) => (i != null ? (i - 1 + images.length) % images.length : null));
  }, [images.length]);

  const lbNext = useCallback(() => {
    setLightbox((i) => (i != null ? (i + 1) % images.length : null));
  }, [images.length]);

  useEffect(() => {
    if (lightbox == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') lbNext();
      else if (e.key === 'ArrowLeft') lbPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, closeLightbox, lbNext, lbPrev]);

  /* ── scroll reveal ────────────────────────────────────────────── */
  useEffect(() => {
    const selector = isIncognito ? '.incognito__frame' : '.gallery-item';
    const items = document.querySelectorAll<HTMLElement>(selector);
    if (!items.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add(isIncognito ? 'incognito__frame--visible' : 'gallery-item--visible');
            io.unobserve(e.target);
          }
        }),
      {threshold: 0.05, rootMargin: '0px 0px -40px 0px'},
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [archive, isIncognito]);

  /* ── touch swipe ──────────────────────────────────────────────── */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? lbNext() : lbPrev();
  };

  /* ── Empty state ──────────────────────────────────────────────── */
  if (!archive) {
    return (
      <div className="gallery-page">
        <div className="gallery-group-header">
          <Link to="/pages/gallery" className="gallery-group-back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Gallery
          </Link>
          <h1 className="gallery-group-header__name">{archiveName}</h1>
        </div>
        <div className="gallery-coming-soon">
          <p className="gallery-coming-soon__sub">No photos found for this archive.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="gallery-page">
        {/* ── Archive Header ─────────────────────────────────────── */}
        <div className="gallery-group-header">
          <Link to="/pages/gallery" className="gallery-group-back" prefetch="intent">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Gallery
          </Link>
          <div className="gallery-group-header__content">
            <p className="gallery-group-header__eyebrow">Archive</p>
            <h1 className="gallery-group-header__name">{archive.name}</h1>
            <span className="gallery-group-header__count">{archive.images.length} Photos</span>
          </div>
        </div>

        {/* ── Layout: INCOGNITO (editorial) or standard grid ─────── */}
        {isIncognito ? (
          <section className="incognito">
            {/* Hero — first image fills the viewport */}
            {images[0] && (
              <button className="incognito__frame incognito__hero" onClick={() => openLightbox(0)} aria-label="Open photo 1">
                <img src={images[0].url} alt={images[0].alt || 'Incognito 1'} loading="eager" className="incognito__img" />
                <div className="incognito__scrim" aria-hidden="true" />
              </button>
            )}

            {/* Diptych — two images side by side, asymmetric heights */}
            {images.length >= 3 && (
              <div className="incognito__diptych">
                <button className="incognito__frame incognito__diptych-tall" onClick={() => openLightbox(1)} aria-label="Open photo 2">
                  <img src={images[1].url} alt={images[1].alt || 'Incognito 2'} loading="lazy" className="incognito__img" />
                  <div className="incognito__scrim" aria-hidden="true" />
                </button>
                <button className="incognito__frame incognito__diptych-short" onClick={() => openLightbox(2)} aria-label="Open photo 3">
                  <img src={images[2].url} alt={images[2].alt || 'Incognito 3'} loading="lazy" className="incognito__img" />
                  <div className="incognito__scrim" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Cinematic strip — wide panoramic frame */}
            {images[3] && (
              <button className="incognito__frame incognito__cinema" onClick={() => openLightbox(3)} aria-label="Open photo 4">
                <img src={images[3].url} alt={images[3].alt || 'Incognito 4'} loading="lazy" className="incognito__img" />
                <div className="incognito__scrim" aria-hidden="true" />
              </button>
            )}

            {/* Statement — final image, centered with generous whitespace */}
            {images[4] && (
              <button className="incognito__frame incognito__statement" onClick={() => openLightbox(4)} aria-label="Open photo 5">
                <img src={images[4].url} alt={images[4].alt || 'Incognito 5'} loading="lazy" className="incognito__img" />
                <div className="incognito__scrim" aria-hidden="true" />
              </button>
            )}

            {/* Overflow — any extra images beyond 5 */}
            {images.length > 5 && (
              <div className="incognito__overflow">
                {images.slice(5).map((img, idx) => (
                  <button
                    key={img.id}
                    className="incognito__frame"
                    onClick={() => openLightbox(idx + 5)}
                    aria-label={`Open photo ${idx + 6}`}
                  >
                    <img src={img.url} alt={img.alt || `Incognito ${idx + 6}`} loading="lazy" className="incognito__img" />
                    <div className="incognito__scrim" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section className="gallery-section gallery-section--group">
            <div className="gallery-grid">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  className="gallery-item"
                  style={getItemSpan(idx)}
                  onClick={() => openLightbox(idx)}
                  aria-label={`Open ${archive.name} photo ${idx + 1}`}
                >
                  <img
                    src={img.url}
                    alt={img.alt || `${archive.name} ${idx + 1}`}
                    loading={idx < 4 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="gallery-item__img"
                  />
                  <div className="gallery-item__overlay" aria-hidden="true">
                    <svg className="gallery-item__icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
                      <rect x="0.75" y="0.75" width="20.5" height="20.5" rx="1.25" stroke="white" strokeWidth="1.5" />
                      <path d="M7 11h8M11 7v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── More Archives ──────────────────────────────────────── */}
        {otherArchives.length > 0 && (
          <section className="gallery-explore gallery-explore--footer">
            <div className="gallery-explore__header">
              <h2 className="gallery-explore__title">More Archives</h2>
            </div>
            <div className="gallery-explore__grid">
              {otherArchives.map((a) => {
                const thumb = a.images[0];
                return (
                  <Link key={a.slug} to={`/pages/gallery/${a.slug}`} className="gallery-explore__card" prefetch="intent">
                    {thumb && <img src={thumb.url} alt={thumb.alt || a.name} loading="lazy" className="gallery-explore__card-img" />}
                    <div className="gallery-explore__card-overlay" />
                    <div className="gallery-explore__card-content">
                      <p className="gallery-explore__card-label">{a.name}</p>
                      <span className="gallery-explore__card-count">{a.images.length} photos</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────── */}
      {lightbox != null && lbImg && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${archive.name} — photo ${lightbox + 1} of ${images.length}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="gallery-lightbox__backdrop" onClick={closeLightbox} />
          <div className="gallery-lightbox__stage" key={lightbox}>
            <img src={lbImg.url} alt={lbImg.alt || `${archive.name} ${lightbox + 1}`} className="gallery-lightbox__img" />
          </div>
          <button className="gallery-lightbox__close" onClick={closeLightbox} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          {images.length > 1 && (
            <>
              <button className="gallery-lightbox__nav gallery-lightbox__nav--prev" onClick={lbPrev} aria-label="Previous photo">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M11 3L5 9L11 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button className="gallery-lightbox__nav gallery-lightbox__nav--next" onClick={lbNext} aria-label="Next photo">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M7 3L13 9L7 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          <div className="gallery-lightbox__footer">
            <span className="gallery-lightbox__shoot">{archive.name}</span>
            {images.length <= 30 && (
              <div className="gallery-lightbox__dots" aria-hidden="true">
                {images.map((_, i) => (
                  <button
                    key={i}
                    className={`gallery-lightbox__dot${i === lightbox ? ' gallery-lightbox__dot--active' : ''}`}
                    onClick={() => setLightbox(i)}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <span className="gallery-lightbox__counter">
              {lightbox + 1}&thinsp;/&thinsp;{images.length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
