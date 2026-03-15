/**
 * Gallery Route — /gallery
 *
 * Fetches files uploaded to Shopify (Admin API) whose filenames start with
 * TRENDSBYFACES_<Name>_<Initial>  and groups them by the parsed name.
 * Also fetches the TRENDSBYFACES_FEATURE video for the hero.
 */
import type {Route} from './+types/gallery';
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useLoaderData, Link} from 'react-router';
import {getAdminAccessToken, fetchAdminFiles, fetchAdminVideoByFilename} from '~/utils/shopify-admin.server';

export const meta: Route.MetaFunction = () => [
  {title: 'TrendsByAfeez | Gallery'},
  {name: 'description', content: 'Behind the lens — explore our editorial shoots.'},
];

/* ─── Types ─────────────────────────────────────────────────────── */
interface GalleryImage {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  filename: string;
}

interface ShootGroup {
  name: string;
  initial: string;
  images: GalleryImage[];
}

/* ─── Helpers ───────────────────────────────────────────────────── */
function parseFilename(url: string): {name: string; initial: string} | null {
  // Shopify CDN URL ends with the original filename after the last slash
  const parts = url.split('/');
  const raw = decodeURIComponent(parts[parts.length - 1]).split('?')[0];
  // Match TRENDSBYFACES_<NAME>_<INITIAL>...
  const match = raw.match(/^TRENDSBYFACES_([^_]+)_([^_.]+)/i);
  if (!match) return null;
  return {
    name: match[1].toUpperCase(),
    initial: match[2].toUpperCase(),
  };
}

function groupImages(images: GalleryImage[]): ShootGroup[] {
  const map = new Map<string, ShootGroup>();
  for (const img of images) {
    const parsed = parseFilename(img.url);
    if (!parsed) continue;
    const key = `${parsed.name}_${parsed.initial}`;
    if (!map.has(key)) {
      map.set(key, {name: parsed.name, initial: parsed.initial, images: []});
    }
    map.get(key)!.images.push(img);
  }
  return Array.from(map.values());
}

/* ─── Debug types ────────────────────────────────────────────────── */
interface GalleryDebug {
  hasClientId: boolean;
  hasClientSecret: boolean;
  storeDomain: string | null;
  tokenFetchStatus: number | null;
  httpStatus: number | null;
  rawEdgeCount: number;
  mediaImageEdgeCount: number;
  nonMediaImageEdges: string[];
  parsedImageCount: number;
  unparsedUrls: string[];
  groupKeys: string[];
  errorMessage: string | null;
  apiErrors: any[] | null;
}

// Token management and file fetching are handled by ~/utils/shopify-admin.server

/* ─── Loader ─────────────────────────────────────────────────────── */
export async function loader({context}: Route.LoaderArgs) {
  const env = (context as any).env as Record<string, string | undefined>;
  const clientId = env?.SHOPIFY_CLIENT_ID;
  const clientSecret = env?.SHOPIFY_CLIENT_SECRET;
  const storeDomain = env?.PUBLIC_STORE_DOMAIN;
  const debugMode = env?.GALLERY_DEBUG === 'true';

  const debug: GalleryDebug = {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    storeDomain: storeDomain ?? null,
    tokenFetchStatus: null,
    httpStatus: null,
    rawEdgeCount: 0,
    mediaImageEdgeCount: 0,
    nonMediaImageEdges: [],
    parsedImageCount: 0,
    unparsedUrls: [],
    groupKeys: [],
    errorMessage: null,
    apiErrors: null,
  };

  if (debugMode) console.log('[Gallery] loader start — hasClientId:', debug.hasClientId, '| hasClientSecret:', debug.hasClientSecret, '| storeDomain:', debug.storeDomain);

  if (!clientId || !clientSecret || !storeDomain) {
    if (debugMode) console.warn('[Gallery] Missing SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, or PUBLIC_STORE_DOMAIN — rendering unconfigured state');
    return {groups: [] as ShootGroup[], configured: false, debug, debugMode, videoUrl: null as string | null};
  }

  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(storeDomain, clientId, clientSecret, debugMode);
    debug.tokenFetchStatus = 200;
  } catch (err) {
    debug.errorMessage = String(err);
    debug.tokenFetchStatus = 0;
    console.error('[Gallery] Failed to obtain admin token:', err);
    return {groups: [] as ShootGroup[], configured: true, debug, debugMode, videoUrl: null as string | null};
  }

  try {
    if (debugMode) console.log('[Gallery] Fetching files via shopify-admin utility…');

    const fileNodes = await fetchAdminFiles(storeDomain, adminToken, {
      filenamePrefix: 'TRENDSBYFACES_',
      limit: 250,
      debugMode,
    });

    debug.httpStatus = 200;
    debug.rawEdgeCount = fileNodes.length;
    debug.mediaImageEdgeCount = fileNodes.length;

    if (debugMode) console.log('[Gallery] Files returned:', fileNodes.length);

    const images: GalleryImage[] = fileNodes
      .filter((f) => f.image !== null)
      .map((f) => ({
        id: f.id,
        url: f.image!.url,
        alt: f.alt,
        width: f.image!.width,
        height: f.image!.height,
        filename: f.image!.url.split('/').pop()?.split('?')[0] ?? '',
      }));

    debug.parsedImageCount = images.length;

    const unparsed = images.filter((img) => !parseFilename(img.url));
    debug.unparsedUrls = unparsed.map((img) => img.url);
    if (debugMode && unparsed.length) {
      console.warn('[Gallery] URLs not matching TRENDSBYFACES_ pattern:', debug.unparsedUrls);
    }

    const groups = groupImages(images);
    debug.groupKeys = groups.map((g) => `${g.name}_${g.initial} (${g.images.length} imgs)`);
    if (debugMode) console.log('[Gallery] Groups formed:', debug.groupKeys);

    // Fetch feature video separately (non-blocking — returns null on failure)
    let videoUrl: string | null = null;
    try {
      const video = await fetchAdminVideoByFilename(storeDomain, adminToken, 'TRENDSBYFACES_FEATURE');
      const mp4 = video?.sources.find((s) => s.format === 'mp4' || s.mimeType === 'video/mp4');
      videoUrl = mp4?.url ?? video?.sources[0]?.url ?? null;
    } catch {
      // Video is optional — fail silently
    }

    return {groups, configured: true, debug, debugMode, videoUrl};
  } catch (err) {
    debug.errorMessage = String(err);
    console.error('[Gallery] loader error:', err);
    return {groups: [] as ShootGroup[], configured: true, debug, debugMode, videoUrl: null as string | null};
  }
}

/* ─── Debug panel ────────────────────────────────────────────────── */
function DebugPanel({debug}: {debug: GalleryDebug}) {
  const rows: [string, React.ReactNode][] = [
    ['hasClientId', String(debug.hasClientId)],
    ['hasClientSecret', String(debug.hasClientSecret)],
    ['storeDomain', debug.storeDomain ?? '(null)'],
    ['tokenFetchStatus', debug.tokenFetchStatus ?? '(not attempted)'],
    ['httpStatus', debug.httpStatus ?? '(not fetched)'],
    ['rawEdgeCount', debug.rawEdgeCount],
    ['mediaImageEdgeCount', debug.mediaImageEdgeCount],
    ['parsedImageCount', debug.parsedImageCount],
    ['groupKeys', debug.groupKeys.length ? debug.groupKeys.join(', ') : '(none)'],
    ['unparsedUrls', debug.unparsedUrls.length ? debug.unparsedUrls.join('\n') : '(none)'],
    ['nonMediaImageEdges', debug.nonMediaImageEdges.length ? debug.nonMediaImageEdges.join(', ') : '(none)'],
    ['apiErrors', debug.apiErrors ? JSON.stringify(debug.apiErrors, null, 2) : '(none)'],
    ['errorMessage', debug.errorMessage ?? '(none)'],
  ];
  return (
    <details open style={{margin:'1rem',padding:'1rem',background:'#1a1a1a',border:'1px solid #ff4444',borderRadius:'6px',fontFamily:'monospace',fontSize:'12px',color:'#eee',position:'relative',zIndex:9999}}>
      <summary style={{cursor:'pointer',fontSize:'13px',fontWeight:700,color:'#ff6666'}}>
        🔍 Gallery Debug — GALLERY_DEBUG=true
      </summary>
      <table style={{borderCollapse:'collapse',marginTop:'0.75rem',width:'100%'}}>
        <tbody>
          {rows.map(([key, val]) => (
            <tr key={key} style={{borderBottom:'1px solid #333'}}>
              <td style={{padding:'4px 8px',color:'#aaa',whiteSpace:'nowrap',verticalAlign:'top'}}>{key}</td>
              <td style={{padding:'4px 8px',whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
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
  const {groups, configured, debug, debugMode, videoUrl} = useLoaderData<typeof loader>();
  const [lightbox, setLightbox] = useState<{groupIdx: number; imgIdx: number} | null>(null);
  const touchStartX = useRef(0);

  const lbGroup = lightbox != null ? groups[lightbox.groupIdx] : null;
  const lbImg = lbGroup ? lbGroup.images[lightbox!.imgIdx] : null;

  /* ── lightbox helpers ─────────────────────────────────────────── */
  const openLightbox = useCallback((groupIdx: number, imgIdx: number) => {
    setLightbox({groupIdx, imgIdx});
    document.body.style.overflow = 'hidden';
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
    document.body.style.overflow = '';
  }, []);

  const lbPrev = useCallback(() => {
    setLightbox(lb => {
      if (!lb) return lb;
      const imgs = groups[lb.groupIdx]?.images;
      if (!imgs) return lb;
      return {...lb, imgIdx: (lb.imgIdx - 1 + imgs.length) % imgs.length};
    });
  }, [groups]);

  const lbNext = useCallback(() => {
    setLightbox(lb => {
      if (!lb) return lb;
      const imgs = groups[lb.groupIdx]?.images;
      if (!imgs) return lb;
      return {...lb, imgIdx: (lb.imgIdx + 1) % imgs.length};
    });
  }, [groups]);

  /* ── keyboard navigation ──────────────────────────────────────── */
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') lbNext();
      else if (e.key === 'ArrowLeft') lbPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, closeLightbox, lbNext, lbPrev]);

  /* ── scroll-reveal ────────────────────────────────────────────── */
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
  }, [groups]);

  /* ── touch swipe in lightbox ──────────────────────────────────── */
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? lbNext() : lbPrev();
  };

  /* ── coming soon ──────────────────────────────────────────────── */
  if (!configured || groups.length === 0) {
    return (
      <>
        {debugMode && <DebugPanel debug={debug} />}
        <div className="gallery-page">
          <div className="gallery-video-hero gallery-video-hero--empty">
            <div className="gallery-video-hero__content">
              <p className="gallery-video-hero__eyebrow">Behind the Lens</p>
              <h1 className="gallery-video-hero__title">Gallery</h1>
            </div>
          </div>
          <div className="gallery-coming-soon">
            <p className="gallery-coming-soon__sub">Editorial shoots — coming soon.</p>
          </div>
        </div>
      </>
    );
  }

  const featuredGroup = groups[0];
  const otherGroups = groups.slice(1);
  const totalPhotos = groups.reduce((t, g) => t + g.images.length, 0);
  const FEATURED_PREVIEW = 8; // images shown in featured section before "View all" link

  return (
    <>
      {debugMode && <DebugPanel debug={debug} />}
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
              {groups.length} Shoot{groups.length > 1 ? 's' : ''}&ensp;&middot;&ensp;{totalPhotos} Photos
            </p>
          </div>
        </div>

        {/* ── Featured Collection ───────────────────────────────── */}
        <section className="gallery-featured">
          <div className="gallery-featured__header">
            <div className="gallery-featured__label">
              <span className="gallery-featured__eyebrow">Featured</span>
              <h2 className="gallery-featured__name">{featuredGroup.name}</h2>
            </div>
            <Link
              to={`/gallery/${featuredGroup.name.toLowerCase()}`}
              className="gallery-featured__view-all"
              prefetch="intent"
            >
              View all {featuredGroup.images.length} photos
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 5H8M5 2L8 5L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          <div className="gallery-grid">
            {featuredGroup.images.slice(0, FEATURED_PREVIEW).map((img, imgIdx) => (
              <button
                key={img.id}
                className="gallery-item"
                style={getItemSpan(imgIdx)}
                onClick={() => openLightbox(0, imgIdx)}
                aria-label={`Open ${featuredGroup.name} photo ${imgIdx + 1}`}
              >
                <img
                  src={img.url}
                  alt={img.alt || `${featuredGroup.name} ${imgIdx + 1}`}
                  loading={imgIdx < 4 ? 'eager' : 'lazy'}
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
          {featuredGroup.images.length > FEATURED_PREVIEW && (
            <div className="gallery-featured__footer">
              <Link
                to={`/gallery/${featuredGroup.name.toLowerCase()}`}
                className="gallery-featured__cta"
                prefetch="intent"
              >
                View all {featuredGroup.images.length} photos
              </Link>
            </div>
          )}
        </section>

        {/* ── Explore Other Collections ─────────────────────────── */}
        {otherGroups.length > 0 && (
          <section className="gallery-explore">
            <div className="gallery-explore__header">
              <h2 className="gallery-explore__title">Explore Collections</h2>
            </div>
            <div className="gallery-explore__grid">
              {otherGroups.map((group) => {
                const thumb = group.images[0];
                const slug = group.name.toLowerCase();
                return (
                  <Link
                    key={`${group.name}_${group.initial}`}
                    to={`/gallery/${slug}`}
                    className="gallery-explore__card"
                    prefetch="intent"
                  >
                    {thumb && (
                      <img
                        src={thumb.url}
                        alt={thumb.alt || group.name}
                        loading="lazy"
                        className="gallery-explore__card-img"
                      />
                    )}
                    <div className="gallery-explore__card-overlay" />
                    <div className="gallery-explore__card-content">
                      <p className="gallery-explore__card-label">{group.name}</p>
                      <span className="gallery-explore__card-count">{group.images.length} photos</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── Lightbox ─────────────────────────────────────────────── */}
      {lightbox != null && lbGroup && lbImg && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${lbGroup.name} — photo ${lightbox.imgIdx + 1} of ${lbGroup.images.length}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="gallery-lightbox__backdrop" onClick={closeLightbox} />
          <div className="gallery-lightbox__stage" key={`${lightbox.groupIdx}-${lightbox.imgIdx}`}>
            <img
              src={lbImg.url}
              alt={lbImg.alt || `${lbGroup.name} ${lightbox.imgIdx + 1}`}
              className="gallery-lightbox__img"
            />
          </div>
          <button className="gallery-lightbox__close" onClick={closeLightbox} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {lbGroup.images.length > 1 && (
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
            <span className="gallery-lightbox__shoot">{lbGroup.name}</span>
            {lbGroup.images.length <= 30 && (
              <div className="gallery-lightbox__dots" aria-hidden="true">
                {lbGroup.images.map((_, i) => (
                  <button
                    key={i}
                    className={`gallery-lightbox__dot${i === lightbox.imgIdx ? ' gallery-lightbox__dot--active' : ''}`}
                    onClick={() => setLightbox(lb => lb ? {...lb, imgIdx: i} : lb)}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
              </div>
            )}
            <span className="gallery-lightbox__counter">
              {lightbox.imgIdx + 1}&thinsp;/&thinsp;{lbGroup.images.length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
