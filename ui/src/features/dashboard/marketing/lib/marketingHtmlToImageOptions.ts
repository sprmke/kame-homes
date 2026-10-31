export type MarketingHtmlToImageOptions = {
  skipFonts?: boolean;
  cacheBust?: boolean;
  pixelRatio?: number;
  quality?: number;
  backgroundColor?: string;
  type?: string;
  [key: string]: unknown;
};

/** Cross-origin Google Fonts stylesheets throw when html-to-image reads cssRules. */
export function marketingHtmlToImageOptions(
  overrides: MarketingHtmlToImageOptions = {}
): MarketingHtmlToImageOptions {
  return {
    skipFonts: true,
    ...overrides,
  };
}
