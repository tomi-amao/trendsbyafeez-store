/**
 * Gallery Route — /pages/gallery
 *
 * Displays a video hero and a grid of archive thumbnail cards.
 * Each card links to the archive's full page. No lightbox on this index.
 */
import type {Route} from './+types/pages.gallery._index';
import {useEffect, useRef} from 'react';
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

    const featured: Archive = {name: 'TrendsByUs', slug: 'trendsbyfaces', images: tbaImages};
    const otherArchives: Archive[] = [];
    if (incognitoImages.length > 0) {
      otherArchives.push({name: 'Incognito', slug: 'incognito', images: incognitoImages});
    }

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

/* ─── Component ──────────────────────────────────────────────────── */
export default function GalleryPage() {
  const {featured, otherArchives, videoUrl, configured} = useLoaderData<typeof loader>();
  const gridRef = useRef<HTMLDivElement>(null);

  const allArchives = featured ? [featured, ...otherArchives] : otherArchives;
  const totalPhotos = allArchives.reduce((t, a) => t + a.images.length, 0);

  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll<HTMLElement>('.gallery-archive-card');
    if (!cards?.length) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add('gallery-archive-card--visible');
            io.unobserve(e.target);
          }
        }),
      {threshold: 0.08, rootMargin: '0px 0px -60px 0px'},
    );
    cards.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [allArchives]);

  if (!configured || allArchives.length === 0) {
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
    <div className="gallery-page">
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
          <h1 className="gallery-video-hero__title">Archives</h1>
          <p className="gallery-video-hero__meta">
            {allArchives.length} Archive{allArchives.length > 1 ? 's' : ''}
            {' · '}{totalPhotos} Photos
          </p>
        </div>
      </div>

      <section className="gallery-archives">
        <header className="gallery-archives__header">
          <span className="gallery-archives__eyebrow">Explore</span>
          {/* <h2 className="gallery-archives__title">Archives</h2> */}
          <span className="gallery-archives__total">
            {allArchives.length} archive{allArchives.length > 1 ? 's' : ''}
          </span>
        </header>

        <div className="gallery-archives__grid" ref={gridRef}>
          {allArchives.map((archive, idx) => {
            const primary = archive.images[0];
            const stripImages = archive.images.slice(1, 4);
            const num = String(idx + 1).padStart(2, '0');

            return (
              <Link
                key={archive.slug}
                to={`/pages/gallery/${archive.slug}`}
                className="gallery-archive-card"
                prefetch="intent"
                aria-label={`${archive.name} — ${archive.images.length} photos`}
              >
                {primary && (
                  <img
                    src={primary.url}
                    alt={primary.alt || archive.name}
                    className="gallery-archive-card__primary"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                )}
                <div className="gallery-archive-card__overlay" aria-hidden="true" />
                <span className="gallery-archive-card__num" aria-hidden="true">
                  {num}
                </span>
                {stripImages.length > 0 && (
                  <div className="gallery-archive-card__strip" aria-hidden="true">
                    {stripImages.map((img, si) => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt=""
                        className="gallery-archive-card__strip-img"
                        loading="lazy"
                        decoding="async"
                        style={{transitionDelay: `${si * 0.04}s`}}
                      />
                    ))}
                  </div>
                )}
                <div className="gallery-archive-card__content">
                  <div>
                    <div className="gallery-archive-card__bar" aria-hidden="true" />
                    <h3 className="gallery-archive-card__name">{archive.name}</h3>
                    <p className="gallery-archive-card__meta">
                      <span>{archive.images.length} photos</span>
                    </p>
                  </div>
                  <span className="gallery-archive-card__cta" aria-hidden="true">
                    View →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
