/**
 * Gallery Route — /gallery
 *
 * Fetches files uploaded to Shopify (Admin API) whose filenames start with
 * TRENDSBYFACES_<Name>_<Initial>  and groups them by the parsed name.
 *
 * Required environment variable:
 *   SHOPIFY_ADMIN_API_ACCESS_TOKEN  — a Custom App or Private App token with
 *                                     read_files scope.
 *   PUBLIC_STORE_DOMAIN             — e.g. your-store.myshopify.com
 *
 * If the token is not configured the page renders a "coming soon" placeholder.
 */
import type {Route} from './+types/gallery';
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {useLoaderData} from 'react-router';
import {getAdminAccessToken, fetchAdminFiles} from '~/utils/shopify-admin.server';

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
    return {groups: [] as ShootGroup[], configured: false, debug, debugMode};
  }

  let adminToken: string;
  try {
    adminToken = await getAdminAccessToken(storeDomain, clientId, clientSecret, debugMode);
    debug.tokenFetchStatus = 200;
  } catch (err) {
    debug.errorMessage = String(err);
    debug.tokenFetchStatus = 0;
    console.error('[Gallery] Failed to obtain admin token:', err);
    return {groups: [] as ShootGroup[], configured: true, debug, debugMode};
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

    return {groups, configured: true, debug, debugMode};
  } catch (err) {
    debug.errorMessage = String(err);
    console.error('[Gallery] loader error:', err);
    return {groups: [] as ShootGroup[], configured: true, debug, debugMode};
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
  const {groups, configured, debug, debugMode} = useLoaderData<typeof loader>();
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState<{groupIdx: number; imgIdx: number} | null>(null);
  const touchStartX = useRef(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

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

  /* ── scroll-reveal via IntersectionObserver ───────────────────── */
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

  /* ── tab / section scroll ─────────────────────────────────────── */
  const scrollToShoot = useCallback((idx: number) => {
    setActiveIdx(idx);
    const el = sectionRefs.current[idx];
    if (el) {
      const offset = 64 + 36 + 52; // header + announcement + tabs
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({top, behavior: 'smooth'});
    }
  }, []);

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
          <div className="gallery-coming-soon">
            <p className="gallery-coming-soon__eyebrow">Behind the Lens</p>
            <h1 className="gallery-coming-soon__title">Gallery</h1>
            <p className="gallery-coming-soon__sub">Editorial shoots — coming soon.</p>
          </div>
        </div>
      </>
    );
  }

  const totalPhotos = groups.reduce((t, g) => t + g.images.length, 0);

  return (
    <>
      {debugMode && <DebugPanel debug={debug} />}
      <div className="gallery-page">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <div className="gallery-hero">
          <p className="gallery-hero__eyebrow">Behind the Lens</p>
          <h1 className="gallery-hero__title">
            <span className="gallery-hero__title-inner">Gallery</span>
          </h1>
          <p className="gallery-hero__meta">
            {groups.length} Shoot{groups.length > 1 ? 's' : ''}&ensp;&middot;&ensp;{totalPhotos} Photos
          </p>
          <div className="gallery-hero__scroll-cue" aria-hidden="true">
            <span>Scroll</span>
            <svg width="1" height="32" viewBox="0 0 1 32" fill="none">
              <line x1="0.5" y1="0" x2="0.5" y2="32" stroke="rgba(0,0,0,0.2)" strokeWidth="1"/>
            </svg>
          </div>
        </div>

        {/* ── Shoot tabs ─────────────────────────────────────────── */}
        <nav className="gallery-tabs" aria-label="Shoots">
          {groups.map((g, i) => (
            <button
              key={`${g.name}_${g.initial}`}
              className={`gallery-tab${activeIdx === i ? ' gallery-tab--active' : ''}`}
              onClick={() => scrollToShoot(i)}
              aria-current={activeIdx === i ? 'true' : undefined}
            >
              {g.name}
              <span className="gallery-tab__count">{g.images.length}</span>
            </button>
          ))}
        </nav>

        {/* ── Shoot sections ─────────────────────────────────────── */}
        {groups.map((group, groupIdx) => (
          <section
            key={`${group.name}_${group.initial}`}
            id={`shoot-${groupIdx}`}
            ref={el => { sectionRefs.current[groupIdx] = el; }}
            className="gallery-section"
          >
            <div className="gallery-section__header">
              <div className="gallery-section__label">
                <span className="gallery-section__num">{String(groupIdx + 1).padStart(2, '0')}</span>
                <h2 className="gallery-section__name">{group.name}</h2>
              </div>
              <span className="gallery-section__count">{group.images.length} Photos</span>
            </div>

            <div className="gallery-grid">
              {group.images.map((img, imgIdx) => (
                <button
                  key={img.id}
                  className="gallery-item"
                  style={getItemSpan(imgIdx)}
                  onClick={() => openLightbox(groupIdx, imgIdx)}
                  aria-label={`Open ${group.name} photo ${imgIdx + 1}`}
                >
                  <img
                    src={img.url}
                    alt={img.alt || `${group.name} ${imgIdx + 1}`}
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
          </section>
        ))}
      </div>

      {/* ── Lightbox ───────────────────────────────────────────────── */}
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

          {/* Close */}
          <button className="gallery-lightbox__close" onClick={closeLightbox} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Prev / Next */}
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

          {/* Footer */}
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
