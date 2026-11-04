import { describe, expect, it } from 'vitest';

import {
  detectPlatform,
  installGuideFor,
  iosSupportsWebPush,
  macosSafariSupportsInstall,
} from '@/lib/pwa/platform';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const SAMSUNG_INTERNET =
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';
const FIREFOX_ANDROID =
  'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0';
const IOS_SAFARI_163 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1';
const IOS_SAFARI_164 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1';
const IOS_SAFARI_18 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IOS_SAFARI_26 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const IOS_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148 Safari/605.1.15';
const IPADOS_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const MACOS_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DESKTOP_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const DESKTOP_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const FACEBOOK_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.1;FBBV/123456;FBID/phone;FBLC/en_US]';
const MESSENGER_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/440.0.0.0]';
const INSTAGRAM = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36 Instagram 300.0.0.0 Android';
const TIKTOK = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c6';
const LINE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.0.0';
const VIBER = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36 Viber/20.0.0';
const GOOGLE_APP = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36 GSA/14.0.0.0';
const TELEGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram/10.0';

describe('detectPlatform', () => {
  it('recognises Android Chrome', () => {
    const info = detectPlatform({ ua: ANDROID_CHROME });
    expect(info.family).toBe('android');
    expect(info.browser).toBe('chrome');
    expect(info.isMobile).toBe(true);
    expect(info.isInAppBrowser).toBe(false);
  });

  it('recognises Samsung Internet as its own browser', () => {
    const info = detectPlatform({ ua: SAMSUNG_INTERNET });
    expect(info.browser).toBe('samsung-internet');
    expect(info.family).toBe('android');
  });

  it('recognises Firefox Android', () => {
    const info = detectPlatform({ ua: FIREFOX_ANDROID });
    expect(info.browser).toBe('firefox');
    expect(info.isMobile).toBe(true);
  });

  it('parses the iOS version from the UA', () => {
    expect(detectPlatform({ ua: IOS_SAFARI_163 }).osVersion).toEqual({ major: 16, minor: 3 });
    expect(detectPlatform({ ua: IOS_SAFARI_26 }).osVersion).toEqual({ major: 26, minor: 0 });
  });

  it('treats iPhone Safari as Safari on the iOS family', () => {
    const info = detectPlatform({ ua: IOS_SAFARI_18 });
    expect(info.isIosFamily).toBe(true);
    expect(info.isSafari).toBe(true);
    expect(info.browser).toBe('safari');
  });

  it('does not call iOS Chrome "Safari"', () => {
    const info = detectPlatform({ ua: IOS_CHROME });
    expect(info.isIosFamily).toBe(true);
    expect(info.browser).toBe('chrome');
    expect(info.isSafari).toBe(false);
  });

  it('recognises iOS Firefox', () => {
    expect(detectPlatform({ ua: IOS_FIREFOX }).browser).toBe('firefox');
  });

  it('detects iPadOS reporting as macOS via touch points', () => {
    const info = detectPlatform({ ua: IPADOS_DESKTOP_MODE, platform: 'MacIntel', maxTouchPoints: 5 });
    expect(info.family).toBe('ipados');
    expect(info.isTablet).toBe(true);
    expect(info.isIosFamily).toBe(true);
  });

  it('treats a real Mac as macOS, not iPadOS', () => {
    const info = detectPlatform({ ua: MACOS_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 });
    expect(info.family).toBe('macos');
    expect(info.isTablet).toBe(false);
  });

  it('recognises desktop Chrome and Edge', () => {
    expect(detectPlatform({ ua: DESKTOP_CHROME }).browser).toBe('chrome');
    expect(detectPlatform({ ua: DESKTOP_EDGE }).browser).toBe('edge');
    expect(detectPlatform({ ua: DESKTOP_FIREFOX }).browser).toBe('firefox');
  });

  it.each([
    ['facebook', FACEBOOK_IOS],
    ['messenger', MESSENGER_ANDROID],
    ['instagram', INSTAGRAM],
    ['tiktok', TIKTOK],
    ['line', LINE],
    ['viber', VIBER],
    ['google-app', GOOGLE_APP],
    ['telegram', TELEGRAM],
  ] as const)('detects the %s in-app browser', (expected, ua) => {
    const info = detectPlatform({ ua });
    expect(info.inAppBrowser).toBe(expected);
    expect(info.isInAppBrowser).toBe(true);
  });

  it('flags a bare Android webview as generic', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.0.0 Mobile Safari/537.36';
    expect(detectPlatform({ ua }).inAppBrowser).toBe('generic-webview');
  });
});

describe('installGuideFor', () => {
  it('returns the iOS Safari guide at 16 and above', () => {
    expect(installGuideFor(detectPlatform({ ua: IOS_SAFARI_164 }))).toBe('ios-safari');
    expect(installGuideFor(detectPlatform({ ua: IOS_SAFARI_26 }))).toBe('ios-safari');
  });

  it('returns no guide below iOS 16', () => {
    const ua = IOS_SAFARI_163.replace('16_3', '15_7');
    expect(installGuideFor(detectPlatform({ ua }))).toBeNull();
  });

  it('gives a different guide to non-Safari iOS browsers', () => {
    expect(installGuideFor(detectPlatform({ ua: IOS_CHROME }))).toBe('ios-other');
  });

  it('returns the macOS Safari guide on Safari 17+', () => {
    expect(installGuideFor(detectPlatform({ ua: MACOS_SAFARI, platform: 'MacIntel' }))).toBe(
      'macos-safari'
    );
  });

  it('returns the Android menu guide', () => {
    expect(installGuideFor(detectPlatform({ ua: ANDROID_CHROME }))).toBe('android-menu');
    expect(installGuideFor(detectPlatform({ ua: FIREFOX_ANDROID }))).toBe('android-menu');
  });

  it('returns no guide inside an in-app browser', () => {
    expect(installGuideFor(detectPlatform({ ua: MESSENGER_ANDROID }))).toBeNull();
  });

  it('returns no guide on desktop Chrome (native prompt instead)', () => {
    expect(installGuideFor(detectPlatform({ ua: DESKTOP_CHROME }))).toBeNull();
  });
});

describe('iosSupportsWebPush', () => {
  it('requires 16.4 or newer', () => {
    expect(iosSupportsWebPush(detectPlatform({ ua: IOS_SAFARI_163 }))).toBe(false);
    expect(iosSupportsWebPush(detectPlatform({ ua: IOS_SAFARI_164 }))).toBe(true);
    expect(iosSupportsWebPush(detectPlatform({ ua: IOS_SAFARI_18 }))).toBe(true);
  });

  it('is false outside the iOS family', () => {
    expect(iosSupportsWebPush(detectPlatform({ ua: ANDROID_CHROME }))).toBe(false);
  });
});

describe('macosSafariSupportsInstall', () => {
  it('needs macOS Safari 17+', () => {
    expect(macosSafariSupportsInstall(detectPlatform({ ua: MACOS_SAFARI }))).toBe(true);
    expect(macosSafariSupportsInstall(detectPlatform({ ua: DESKTOP_CHROME }))).toBe(false);
    expect(macosSafariSupportsInstall(detectPlatform({ ua: ANDROID_CHROME }))).toBe(false);
  });
});
