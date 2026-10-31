import { useEffect, useState } from 'react';

type FaviconLink = {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
};

const DEFAULT_FAVICON_LINKS: FaviconLink[] = [
  { rel: 'icon', type: 'image/png', href: '/favicon/favicon-96x96.png', sizes: '96x96' },
  { rel: 'icon', type: 'image/svg+xml', href: '/favicon/favicon.svg' },
  { rel: 'shortcut icon', href: '/favicon/favicon.ico' },
  { rel: 'apple-touch-icon', href: '/favicon/apple-touch-icon.png', sizes: '180x180' },
];

const FAVICON_SIZE = 96;
const FAVICON_PADDING = 16;
const FAVICON_CORNER_RADIUS = 18;

function removeFaviconLinks() {
  if (typeof document === 'undefined') return;
  const head = document.head;
  const existing = head.querySelectorAll(
    'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );
  existing.forEach((el) => el.remove());
}

function appendDefaultFaviconLinks() {
  if (typeof document === 'undefined') return;
  const head = document.head;
  DEFAULT_FAVICON_LINKS.forEach((attrs) => {
    const link = document.createElement('link');
    link.rel = attrs.rel;
    link.href = attrs.href;
    if (attrs.type) link.type = attrs.type;
    if (attrs.sizes) link.sizes = attrs.sizes;
    head.appendChild(link);
  });
}

function appendLogoFaviconLink(href: string) {
  if (typeof document === 'undefined') return;
  const head = document.head;
  const iconLink = document.createElement('link');
  iconLink.rel = 'icon';
  iconLink.type = 'image/png';
  iconLink.href = href;
  head.appendChild(iconLink);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generatePaddedLogoFavicon(logoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);

    const canvas = document.createElement('canvas');
    canvas.width = FAVICON_SIZE;
    canvas.height = FAVICON_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const drawSize = FAVICON_SIZE - FAVICON_PADDING * 2;
      const innerRadius = Math.max(6, FAVICON_CORNER_RADIUS - FAVICON_PADDING / 2);

      // White rounded background so the favicon does not look like a sharp box.
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, 0, 0, FAVICON_SIZE, FAVICON_SIZE, FAVICON_CORNER_RADIUS);
      ctx.fill();

      // Draw the logo with padding, clipped to a rounded inner area.
      ctx.save();
      drawRoundedRect(ctx, FAVICON_PADDING, FAVICON_PADDING, drawSize, drawSize, innerRadius);
      ctx.clip();
      ctx.drawImage(img, FAVICON_PADDING, FAVICON_PADDING, drawSize, drawSize);
      ctx.restore();

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = logoUrl;
  });
}

/**
 * Sets the favicon to a padded, rounded-corner version of the provided logo URL,
 * or restores the default Kame favicon when the logo URL is null/undefined/empty.
 *
 * The logo is drawn on a 96×96 canvas with ~16px padding and rounded corners so
 * it does not appear as a sharp box in the browser tab.
 */
export function useFavicon(logoUrl: string | null | undefined) {
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const effectiveLogo = logoUrl?.trim();

    if (!effectiveLogo) {
      setGeneratedUrl(null);
      removeFaviconLinks();
      appendDefaultFaviconLinks();
      return;
    }

    // Keep the previous generated favicon while generating the new one to avoid
    // flashing the default icon between navigations.
    generatePaddedLogoFavicon(effectiveLogo).then((dataUrl) => {
      if (cancelled) return;
      setGeneratedUrl(dataUrl);
      removeFaviconLinks();
      appendLogoFaviconLink(dataUrl ?? effectiveLogo);
    });

    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  // On first render, if no logo is known yet, make sure the default links exist
  // (they are already in index.html, but this defends against HMR remounts).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const head = document.head;
    const existing = head.querySelectorAll(
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    );
    if (existing.length === 0) {
      appendDefaultFaviconLinks();
    }
  }, []);

  return generatedUrl;
}
