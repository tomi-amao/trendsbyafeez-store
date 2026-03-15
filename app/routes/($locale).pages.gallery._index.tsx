/**
 * Gallery Route — /pages/gallery
 *
 * Displays the featured TRENDSBYFACES archive with video hero,
 * and links to explore other archives (INCOGNITO, etc.).
 */
import type {Route} from './+types/pages.gallery._index';
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useLoaderData, Link} from 'react-router';
import {getAdminAccessToken, fetchAdminFiles, fetchAdminVideoByFilename} from '~/utils/shopify-admin.server';

export const meta: Route.MetaFunction = () => [
  {title: 'TrendsByAfeez | Gallery'},
  {name: 'description', content: 'Behind the lens — explore our editorial archives.'},
];

/* ─── Types ─────────────────────────────────────────────────────── */
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

/* ─── Loader ─────────────────────────────────────────────────────── */
export async function loader({context}: Route.LoaderArgs) {
  const env = (context as any).env as Record<string, string | undefined>;
  const clientId = env?.SHOPIFY_CLIENT_ID;
  const clientSecret = env?.SHOPIFY_CLIENT_SECRET;
  const storeDomain = env?.PUBLIC_STORE_DOMAIN;

  const empty = {featured: null as Archive | null, otherArchives: [] as Archive[], videoUrl: null as string | null, configured: false};

  if (!clientId || !clientSecret || !storeDomain) return empty;

  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(storeDomain, clientId, clientSecret);
  } catch {
    return {...empty, configured: true};
  }

  try {
    // Fetch TRENDSBYFACES_ images and INCOGNITO_ images in parallel
    const [tbaFiles, incognitoFiles] = await Promise.all([
      fetchAdminFiles(storeDomain, adminToken, {filenamePrefix: 'TRENDSBYFACES_', limit: 250}),
      fetchAdminFiles(storeDomain, adminToken, {filenamePrefix: 'INCOGNITO_', limit: 250}),
    ]);

    const toImages = (files: typeof tbaFiles): GalleryImage[] =>
      files
        .filter((f) => f.image !== null)
        .map((f) => ({
          id: f.id,
          url: f.image!.url,
          alt: f.alt,
          width: f.image!.width,
          height: f.image!.height,
        }));

    const tbaImages = toImages(tbaFiles);
    const incognitoImages = toImages(incognitoFiles);

    const featured: Archive = {name: 'TrendsByFaces', slug: 'trendsbyfaces', images: tbaImages};
    const otherArchives: Archive[] = [];
    if (incognitoImages.length > 0) {
      otherArchives.push({name: 'Incognito', slug: 'incognito', images: incognitoImages});
    }

    // Fetch feature video
    let videoUrl: string | null = null;
    try {
      const video = await fetchAdminVideoByFilename(storeDomain, adminToken, 'TRENDSBYFACES_FEATURE');
      const mp4 = video?.sources.find((s) => s.format === 'mp4' || s.mimeType === 'video/mp4');
      videoUrl = mp4?.url ?? video?.sources[0]?.url ?? null;
    } catch {
      // Video is optional
    }

    return {featured: tbaImages.length > 0 ? featured : null, otherArchives, videoUrl, configured: true};
  } catch {
    return {...empty, configured: true};
  }
}

/* ─── Grid span helper ───────────────────────────────────────────── */
function getItemSpan(idx: number): React.CSSProperties {
  if (idx === 0) return {gridColumn: 'span 2', gridRow: 'span 2'};
  const c = (idx - 1) % 7;
  if (c === 3) return {gridColumn: 'span 2'};
  if (c === 5) return {gridRow: 'span 2'};
  return {};
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function GalleryPage() {
  const {featured, otherArchives, videoUrl, configured} = useLoaderData<typeof loader>();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchStartX = useRef(0);

  const featuredImages = featured?.images ?? [];
  const lbImg = lightbox != null ? featuredImages[lightbox] : null;

  const FEATURED_PREVIEW = 8;

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
    setLightbox(i => (i != null ? (i - 1 + featuredImages.length) % featuredImages.length : null));
  }, [featuredImages.length]);

  const lbNext = useCallback(() => {
    setLightbox(i => (i != null ? (i + 1) % featuredImages.length : null));
  }, [featuredImages.length]);

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

  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('.gallery-item');
    if (!items.length) return;
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add('gallery-item--visible');
          io.unobserve(e.target);
        }
      }),
      {threshold: 0.05, rootMargin: '0px 0px -40px 0px'},
    );
    items.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [featured]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? lbNext() : lbPrev();
  };

  const totalPhotos = (featured?.images.length ?? 0) + otherArchives.reduce((t, a) => t + a.images.length, 0);
  const archiveCount = (featured ? 1 : 0) + otherArchives.length;

  /* ── empty state ──────────────────────────────────────────────── */
  if (!configured || !featured) {
    return (
      <div className="gallery-page">
        <div className="gallery-video-hero gallery-video-hero--empty">
          <div className="gallery-video-hero__overlay" />
          <div className="gallery-video-hero__content">
            <p className="gallery-video-hero__eyebrow">Behind the Lens</p>
            <h1 className="gallery-video-hero__title">Gallery</h1>
          </div>
        </div>
        <div className="gallery-coming-soon">
          <p className="gallery-coming-soon__sub">Editorial archives — coming soon.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="gallery-page">

        {/* ── Video Hero ────────────────────────────────────────── */}
        <div className="gallery-video-hero">
          {videoUrl ? (
            <video
              className="gallery-video-hero__video"
              autoPlay
              muted
              loop
              playsInline
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
          ) : (
            <div className="gallery-video-hero__placeholder" />
          )}
          <div className="gallery-video-hero__overlay" />
          <div className="gallery-video-hero__content">
            <p className="gallery-video-hero__eyebrow">Behind the Lens</p>
            <h1 className="gallery-video-hero__title">Gallery</h1>
            <p className="gallery-video-hero__meta">
              {archiveCount} Archive{archiveCount > 1 ? 's' : ''}&ensp;&middot;&ensp;{totalPhotos} Photos
            </p>
          </div>
        </div>

        {/* ── Featured Archive ──────────────────────────────────── */}
        <section className="gallery-featured">
          <div className="gallery-featured__header">
            <div className="gallery-featured__label">
              <span className="gallery-featured__eyebrow">Featured Archive</span>
              <h2 className="gallery-featured__name">{featured.name}</h2>
            </div>
            <Link
              to={`/pages/gallery/${featured.slug}`}
              className="gallery-featured__view-all"
              prefetch="intent"
            >
              View all {featured.images.length} photos&ensp;&rarr;
            </Link>
          </div>
          <div className="gallery-grid">
            {featured.images.slice(0, FEATURED_PREVIEW).map((img, idx) => (
              <button
                key={img.id}
                className="gallery-item"
                style={getItemSpan(idx)}
                onClick={() => openLightbox(idx)}
                aria-label={`Open ${featured.name} photo ${idx + 1}`}
              >
                <img
                  src={img.url}
                  alt={img.alt || `${featured.name} ${idx + 1}`}
                  loading={idx < 4 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="gallery-item__img"
                />
                <div className="gallery-item__overlay" aria-hidden="true">
                  <svg className="gallery-item__icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="0.75" y="0.75" width="20.5" height="20.5" rx="1.25" stroke="white" strokeWidth="1.5"/>
                    <path d="M7 11h8M11 7v8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>
          {featured.images.length > FEATURED_PREVIEW && (
            <div className="gallery-featured__footer">
              <Link
                to={`/pages/gallery/${featured.slug}`}
                className="gallery-featured__cta"
                prefetch="intent"
              >
                View all {featured.images.length} photos
              </Link>
            </div>
          )}
        </section>

        {/* ── Explore Other Archives ────────────────────────────── */}
        {otherArchives.length > 0 && (
          <section className="gallery-explore">
            <div className="gallery-explore__header">
              <h2 className="gallery-explore__title">Explore Archives</h2>
            </div>
            <div className="gallery-explore__grid">
              {otherArchives.map((archive) => {
                const thumb = archive.images[0];
                return (
                  <Link
                    key={archive.slug}
                    to={`/pages/gallery/${archive.slug}`}
                    className="gallery-explore__card"
                    prefetch="intent"
                  >
                    {thumb && (
                      <img
                        src={thumb.url}
                        alt={thumb.alt || archive.name}
                        loading="lazy"
                        className="gallery-explore__card-img"
                      />
                    )}
                    <div className="gallery-explore__card-overlay" />
                    <div className="gallery-explore__card-content">
                      <p className="gallery-explore__card-label">{archive.name}</p>
                      <span className="gallery-explore__card-count">{archive.images.length} photos</span>
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
          aria-label={`${featured.name} — photo ${lightbox + 1} of ${featuredImages.length}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="gallery-lightbox__backdrop" onClick={closeLightbox} />
          <div className="gallery-lightbox__stage" key={lightbox}>
            <img
              src={lbImg.url}
              alt={lbImg.alt || `${featured.name} ${lightbox + 1}`}
              className="gallery-lightbox__img"
            />
          </div>
          <button className="gallery-lightbox__close" onClick={closeLightbox} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {featuredImages.length > 1 && (
            <>
              <button className="gallery-lightbox__nav gallery-lightbox__nav--prev" onClick={lbPrev} aria-label="Previous photo">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M11 3L5 9L11 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="gallery-lightbox__nav gallery-lightbox__nav--next" onClick={lbNext} aria-label="Next photo">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M7 3L13 9L7 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}
          <div className="gallery-lightbox__footer">
            <span className="gallery-lightbox__shoot">{featured.name}</span>
            {featuredImages.length <= 30 && (
              <div className="gallery-lightbox__dots" aria-hidden="true">
                {featuredImages.map((_, i) => (
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
              {lightbox + 1}&thinsp;/&thinsp;{featuredImages.length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
