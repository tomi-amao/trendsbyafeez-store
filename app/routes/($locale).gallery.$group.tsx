/**
 * Gallery Group Route — /gallery/:group
 *
 * Displays all photos for a specific shoot group, with lightbox,
 * back navigation, and links to explore other groups.
 */
import type {Route} from './+types/gallery.$group';
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useLoaderData, Link} from 'react-router';
import {getAdminAccessToken, fetchAdminFiles} from '~/utils/shopify-admin.server';

export const meta: Route.MetaFunction = ({data}: {data: Awaited<ReturnType<typeof loader>> | undefined}) => [
  {title: `TrendsByAfeez | Gallery — ${data?.groupName ?? ''}`},
  {name: 'description', content: `Editorial photographs from the ${data?.groupName ?? ''} shoot.`},
];

/* ─── Types (reused from gallery.tsx) ───────────────────────────── */
interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

interface ShootGroup {
  name: string;
  initial: string;
  images: GalleryImage[];
}

function parseFilename(url: string): {name: string; initial: string} | null {
  const parts = url.split('/');
  const raw = decodeURIComponent(parts[parts.length - 1]).split('?')[0];
  const match = raw.match(/^TRENDSBYFACES_([^_]+)_([^_.]+)/i);
  if (!match) return null;
  return {name: match[1].toUpperCase(), initial: match[2].toUpperCase()};
}

function groupImages(images: GalleryImage[]): ShootGroup[] {
  const map = new Map<string, ShootGroup>();
  for (const img of images) {
    const parsed = parseFilename(img.url);
    if (!parsed) continue;
    const key = `${parsed.name}_${parsed.initial}`;
    if (!map.has(key)) map.set(key, {name: parsed.name, initial: parsed.initial, images: []});
    map.get(key)!.images.push(img);
  }
  return Array.from(map.values());
}

/* ─── Grid span helper ───────────────────────────────────────────── */
function getItemSpan(idx: number): React.CSSProperties {
  if (idx === 0) return {gridColumn: 'span 2', gridRow: 'span 2'};
  const c = (idx - 1) % 7;
  if (c === 3) return {gridColumn: 'span 2'};
  if (c === 5) return {gridRow: 'span 2'};
  return {};
}

/* ─── Loader ─────────────────────────────────────────────────────── */
export async function loader({context, params}: Route.LoaderArgs) {
  const groupSlug = (params.group ?? '').toLowerCase();
  const env = (context as any).env as Record<string, string | undefined>;
  const clientId = env?.SHOPIFY_CLIENT_ID;
  const clientSecret = env?.SHOPIFY_CLIENT_SECRET;
  const storeDomain = env?.PUBLIC_STORE_DOMAIN;

  if (!clientId || !clientSecret || !storeDomain) {
    return {group: null, otherGroups: [] as ShootGroup[], groupName: groupSlug};
  }

  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(storeDomain, clientId, clientSecret);
  } catch {
    return {group: null, otherGroups: [] as ShootGroup[], groupName: groupSlug};
  }

  try {
    const fileNodes = await fetchAdminFiles(storeDomain, adminToken, {
      filenamePrefix: 'TRENDSBYFACES_',
      limit: 250,
    });

    const images: GalleryImage[] = fileNodes
      .filter((f) => f.image !== null)
      .map((f) => ({
        id: f.id,
        url: f.image!.url,
        alt: f.alt,
        width: f.image!.width,
        height: f.image!.height,
      }));

    const allGroups = groupImages(images);
    const group = allGroups.find((g) => g.name.toLowerCase() === groupSlug) ?? null;
    const otherGroups = allGroups.filter((g) => g.name.toLowerCase() !== groupSlug).slice(0, 4);

    return {group, otherGroups, groupName: group?.name ?? groupSlug.toUpperCase()};
  } catch {
    return {group: null, otherGroups: [] as ShootGroup[], groupName: groupSlug};
  }
}

/* ─── Component ──────────────────────────────────────────────────── */
export default function GalleryGroupPage() {
  const {group, otherGroups, groupName} = useLoaderData<typeof loader>();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchStartX = useRef(0);

  const images = group?.images ?? [];
  const lbImg = lightbox != null ? images[lightbox] : null;

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
    setLightbox(i => (i != null ? (i - 1 + images.length) % images.length : null));
  }, [images.length]);

  const lbNext = useCallback(() => {
    setLightbox(i => (i != null ? (i + 1) % images.length : null));
  }, [images.length]);

  /* ── keyboard ─────────────────────────────────────────────────── */
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
  }, [group]);

  /* ── touch swipe ──────────────────────────────────────────────── */
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? lbNext() : lbPrev();
  };

  if (!group) {
    return (
      <div className="gallery-page">
        <div className="gallery-group-header">
          <Link to="/gallery" className="gallery-group-back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Gallery
          </Link>
          <h1 className="gallery-group-header__name">{groupName}</h1>
        </div>
        <div className="gallery-coming-soon">
          <p className="gallery-coming-soon__sub">No photos found for this collection.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="gallery-page">
        {/* ── Group Header ──────────────────────────────────────── */}
        <div className="gallery-group-header">
          <Link to="/gallery" className="gallery-group-back" prefetch="intent">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Gallery
          </Link>
          <div className="gallery-group-header__content">
            <p className="gallery-group-header__eyebrow">Collection</p>
            <h1 className="gallery-group-header__name">{group.name}</h1>
            <span className="gallery-group-header__count">{group.images.length} Photos</span>
          </div>
        </div>

        {/* ── Full Grid ─────────────────────────────────────────── */}
        <section className="gallery-section gallery-section--group">
          <div className="gallery-grid">
            {group.images.map((img, idx) => (
              <button
                key={img.id}
                className="gallery-item"
                style={getItemSpan(idx)}
                onClick={() => openLightbox(idx)}
                aria-label={`Open ${group.name} photo ${idx + 1}`}
              >
                <img
                  src={img.url}
                  alt={img.alt || `${group.name} ${idx + 1}`}
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
        </section>

        {/* ── Other Collections ─────────────────────────────────── */}
        {otherGroups.length > 0 && (
          <section className="gallery-explore gallery-explore--footer">
            <div className="gallery-explore__header">
              <h2 className="gallery-explore__title">More Collections</h2>
            </div>
            <div className="gallery-explore__grid">
              {otherGroups.map((g) => {
                const thumb = g.images[0];
                return (
                  <Link
                    key={`${g.name}_${g.initial}`}
                    to={`/gallery/${g.name.toLowerCase()}`}
                    className="gallery-explore__card"
                    prefetch="intent"
                  >
                    {thumb && (
                      <img
                        src={thumb.url}
                        alt={thumb.alt || g.name}
                        loading="lazy"
                        className="gallery-explore__card-img"
                      />
                    )}
                    <div className="gallery-explore__card-overlay" />
                    <div className="gallery-explore__card-content">
                      <p className="gallery-explore__card-label">{g.name}</p>
                      <span className="gallery-explore__card-count">{g.images.length} photos</span>
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
          aria-label={`${group.name} — photo ${lightbox + 1} of ${images.length}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="gallery-lightbox__backdrop" onClick={closeLightbox} />
          <div className="gallery-lightbox__stage" key={lightbox}>
            <img
              src={lbImg.url}
              alt={lbImg.alt || `${group.name} ${lightbox + 1}`}
              className="gallery-lightbox__img"
            />
          </div>
          <button className="gallery-lightbox__close" onClick={closeLightbox} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {images.length > 1 && (
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
            <span className="gallery-lightbox__shoot">{group.name}</span>
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
