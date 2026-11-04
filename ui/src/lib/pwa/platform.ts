/**
 * Browser / OS / in-app-browser detection for the install experience.
 *
 * Every function here takes an explicit input (`ua`, `platform`, `maxTouchPoints`)
 * so it is deterministic and unit-testable in Node. The React layer passes
 * `navigator` values in; nothing in this module reads a global.
 *
 * Why not feature detection alone: `beforeinstallprompt` is the only reliable
 * "can install" signal on Chromium, but iOS / macOS Safari and Firefox Android
 * never fire it, so the *guide* variant has to be chosen from the platform.
 * In-app browsers (Facebook, Messenger, Instagram, TikTok, LINE, Viber, the
 * Google app, Telegram) are the important case in PH traffic: they report a
 * Chromium-like engine but cannot install, and their "share" menu differs from
 * the real browser's.
 */

export type PlatformFamily =
  | 'ios'
  | 'ipados'
  | 'android'
  | 'macos'
  | 'windows'
  | 'linux'
  | 'chromeos'
  | 'unknown';

export type BrowserFamily =
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'safari'
  | 'samsung-internet'
  | 'opera'
  | 'other';

export type InAppBrowserId =
  | 'facebook'
  | 'messenger'
  | 'instagram'
  | 'tiktok'
  | 'line'
  | 'viber'
  | 'google-app'
  | 'telegram'
  | 'generic-webview'
  | null;

export type PlatformInfo = {
  family: PlatformFamily;
  browser: BrowserFamily;
  /** Detected OS major version (iOS/iPadOS/macOS/Android), when the UA states it. */
  osVersion: { major: number; minor: number } | null;
  /** Android or iOS WebView wrapper (Facebook etc. are also webviews). */
  inAppBrowser: InAppBrowserId;
  /** True when the platform is an in-app browser or a generic embedded webview. */
  isInAppBrowser: boolean;
  /** True when the device is a phone/tablet form factor. */
  isMobile: boolean;
  isTablet: boolean;
  /** iOS + iPadOS share the Safari "Add to Home Screen" flow. */
  isIosFamily: boolean;
  /**
   * Safari proper on iOS/iPadOS/macOS. Other iOS browsers (Chrome, Firefox,
   * Edge) share WebKit but expose a different share menu, so they get their own
   * guide copy.
   */
  isSafari: boolean;
};

type DetectInput = {
  ua: string;
  /** `navigator.platform` — used for the iPadOS-reporting-as-macOS case. */
  platform?: string;
  maxTouchPoints?: number;
};

/** In-app browser fingerprints. Order matters: Messenger and Facebook share FBAN. */
const IN_APP_PATTERNS: ReadonlyArray<{ id: Exclude<InAppBrowserId, null>; test: RegExp }> = [
  // Facebook Messenger iOS: `... [FBAN/MessengerForiOS;FBAV/...]`, Android: `[FB_IAB/MESSENGER;...]`
  { id: 'messenger', test: /MessengerForiOS|FB_IAB\/MESSENGER|\[FBAN\/Messenger/i },
  { id: 'facebook', test: /FBAN\/|FBAV\/|FB_IAB\/|FB4A|FB4I/i },
  { id: 'instagram', test: /Instagram/i },
  { id: 'tiktok', test: /musical_ly|BytedanceWebview|TikTok|trill_/i },
  { id: 'line', test: /\bLine\/\d/i },
  { id: 'viber', test: /Viber/i },
  // Google app (Search / Discover) webview.
  { id: 'google-app', test: /\bGSA\/\d/i },
  { id: 'telegram', test: /Telegram/i },
];

/** `OS 16_4` (iOS/iPadOS) — the only place the iOS version is reliable. */
function parseIosVersion(ua: string): { major: number; minor: number } | null {
  const osMatch = /\bOS (\d+)[._](\d+)/.exec(ua);
  if (osMatch) {
    return { major: Number(osMatch[1]), minor: Number(osMatch[2]) };
  }
  // iPadOS desktop-mode UAs drop `OS`, but keep `Version/<ios version>`.
  const versionMatch = /\bVersion\/(\d+)[._](\d+)/.exec(ua);
  if (versionMatch) {
    return { major: Number(versionMatch[1]), minor: Number(versionMatch[2]) };
  }
  return null;
}

function parseAndroidVersion(ua: string): { major: number; minor: number } | null {
  const match = /\bAndroid (\d+)(?:\.(\d+))?/.exec(ua);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

function parseMacosVersion(ua: string): { major: number; minor: number } | null {
  // macOS Safari freezes the UA at `Mac OS X 10_15_7` for privacy, so the OS
  // version is useless for feature gating. `Version/<n>` carries the Safari
  // version, which is what "Add to Dock" (Safari 17+) actually depends on.
  const safari = /\bVersion\/(\d+)[._](\d+)/.exec(ua);
  if (safari) return { major: Number(safari[1]), minor: Number(safari[2]) };
  const match = /\bMac OS X (\d+)[._](\d+)/.exec(ua);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

function detectBrowser(ua: string, family: PlatformFamily): BrowserFamily {
  if (/SamsungBrowser\//i.test(ua)) return 'samsung-internet';
  if (/Edg(iOS|A|O)?\//i.test(ua)) return 'edge';
  if (/OPiOS|OPR\/|Opera/i.test(ua)) return 'opera';
  if (/FxiOS|Firefox\//i.test(ua)) return 'firefox';
  if (/CriOS|Chrome\/|Chromium\//i.test(ua)) return 'chrome';
  if (/Safari\//i.test(ua)) return 'safari';
  if (family === 'ios' || family === 'ipados') return 'other';
  return 'other';
}

export function detectPlatform(input: DetectInput): PlatformInfo {
  const ua = input.ua ?? '';
  const navPlatform = input.platform ?? '';
  const maxTouchPoints = input.maxTouchPoints ?? 0;

  const inAppBrowser = IN_APP_PATTERNS.find((p) => p.test.test(ua))?.id ?? null;

  // iPadOS 13+ reports as `Macintosh`; disambiguate with the touch-point count.
  const isIpadDesktopMode = /Macintosh/.test(ua) && navPlatform === 'MacIntel' && maxTouchPoints > 1;

  const isIphoneOrIpod = /iPhone|iPod/.test(ua);
  const isIpad = /iPad/.test(ua) || isIpadDesktopMode;

  let family: PlatformFamily;
  if (isIphoneOrIpod) family = 'ios';
  else if (isIpad) family = 'ipados';
  else if (/Android/i.test(ua)) family = 'android';
  else if (/CrOS/.test(ua)) family = 'chromeos';
  else if (/Macintosh|Mac OS X/.test(ua)) family = 'macos';
  else if (/Windows/.test(ua)) family = 'windows';
  else if (/Linux/i.test(ua)) family = 'linux';
  else family = 'unknown';

  const isIosFamily = family === 'ios' || family === 'ipados';
  const isAndroid = family === 'android';
  const isTablet = isIpad || (isAndroid && !/Mobile/.test(ua));
  const isMobile = isIosFamily || isAndroid;

  const browser = detectBrowser(ua, family);

  const genericWebview = isAndroid && /;\s*wv\)/.test(ua);

  return {
    family,
    browser,
    osVersion: isIosFamily ? parseIosVersion(ua) : isAndroid ? parseAndroidVersion(ua) : parseMacosVersion(ua),
    inAppBrowser: inAppBrowser ?? (genericWebview ? 'generic-webview' : null),
    isInAppBrowser: inAppBrowser !== null || genericWebview,
    isMobile,
    isTablet,
    isIosFamily,
    isSafari: (isIosFamily || family === 'macos') && browser === 'safari',
  };
}

/**
 * iOS / iPadOS Web Push needs 16.4+. Everything below gets the "update iOS"
 * message instead of an install guide.
 */
export function iosSupportsWebPush(info: PlatformInfo): boolean {
  if (!info.isIosFamily) return false;
  const version = info.osVersion;
  if (!version) return false;
  if (version.major > 16) return true;
  return version.major === 16 && version.minor >= 4;
}

/** macOS Safari 17+ can install as a web app (File → Add to Dock). */
export function macosSafariSupportsInstall(info: PlatformInfo): boolean {
  if (info.family !== 'macos' || !info.isSafari) return false;
  return (info.osVersion?.major ?? 0) >= 17;
}

/**
 * Which guided-install flow this platform uses. `null` means "no guide exists" —
 * the caller falls back to a generic "open in your browser" message or hides the
 * affordance.
 */
export type InstallGuideKind = 'ios-safari' | 'ios-other' | 'macos-safari' | 'android-menu';

export function installGuideFor(info: PlatformInfo): InstallGuideKind | null {
  if (info.isInAppBrowser) return null;
  if (info.family === 'ios' || info.family === 'ipados') {
    if ((info.osVersion?.major ?? 0) < 16) return null;
    return info.isSafari ? 'ios-safari' : 'ios-other';
  }
  if (macosSafariSupportsInstall(info)) return 'macos-safari';
  // Firefox Android, Samsung Internet, Chrome Android, Opera: all expose an
  // overflow-menu "Install app" / "Add to Home screen" entry.
  if (info.family === 'android') return 'android-menu';
  return null;
}
