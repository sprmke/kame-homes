/**
 * SSRF guard for user-supplied (or untrusted) outbound HTTP(S) URLs.
 * Shared by marketing remote-audio import and generated-video download.
 * Calendar iCal fetch keeps its own hop/allowlist logic in calendarSyncService.ts
 * (provider host allowlists + webcal://) but uses the same private-IP rules.
 *
 * Production-readiness doc 22 Phase 22.5.
 */

export class UnsafeOutboundUrlError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'UnsafeOutboundUrlError';
    this.code = code;
  }
}

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT
];

export function isPrivateIpLiteral(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return PRIVATE_IPV4.some((re) => re.test(h));
  }
  if (h.includes(':')) {
    const lower = h.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (/^fe[89ab]/.test(lower) || /^f[cd]/.test(lower)) return true;
    const mapped = /::ffff:(\d{1,3}(\.\d{1,3}){3})$/.exec(lower);
    if (mapped) return PRIVATE_IPV4.some((re) => re.test(mapped[1]));
  }
  return false;
}

export type AssertPublicHttpUrlOptions = {
  /** Default false — marketing audio historically allowed http://. */
  httpsOnly?: boolean;
};

/**
 * Shape + private-host checks. Does not fetch. DNS is best-effort (may be
 * unavailable in some runtimes); literal + hostname checks always run.
 */
export async function assertPublicHttpUrl(
  raw: string,
  options: AssertPublicHttpUrlOptions = {}
): Promise<URL> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new UnsafeOutboundUrlError('Enter a valid URL', 'bad_url');
  }

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new UnsafeOutboundUrlError('Enter a valid URL', 'bad_url');
  }

  if (options.httpsOnly) {
    if (u.protocol !== 'https:') {
      throw new UnsafeOutboundUrlError('URL must start with https://', 'not_https');
    }
  } else if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new UnsafeOutboundUrlError('URL must start with http:// or https://', 'not_http');
  }

  if (u.username || u.password) {
    throw new UnsafeOutboundUrlError('URL must not contain credentials', 'has_credentials');
  }

  await assertHostNotPrivate(u.hostname);
  return u;
}

async function assertHostNotPrivate(host: string): Promise<void> {
  if (isPrivateIpLiteral(host)) {
    throw new UnsafeOutboundUrlError(`That host is not allowed`, 'private_host');
  }
  const bare = host.toLowerCase();
  if (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    bare.endsWith('.internal') ||
    bare.endsWith('.local')
  ) {
    throw new UnsafeOutboundUrlError('That host is not allowed', 'private_host');
  }

  try {
    const [a, aaaa] = await Promise.allSettled([
      Deno.resolveDns(host, 'A'),
      Deno.resolveDns(host, 'AAAA'),
    ]);
    const addrs = [
      ...(a.status === 'fulfilled' ? a.value : []),
      ...(aaaa.status === 'fulfilled' ? aaaa.value : []),
    ];
    for (const addr of addrs) {
      if (isPrivateIpLiteral(addr)) {
        throw new UnsafeOutboundUrlError('That host is not allowed', 'private_host');
      }
    }
  } catch (err) {
    if (err instanceof UnsafeOutboundUrlError) throw err;
  }
}

export type FetchPublicHttpOptions = AssertPublicHttpUrlOptions & {
  maxHops?: number;
  timeoutMs?: number;
};

/**
 * Fetch a URL with hop-by-hop revalidation. Never uses `redirect: 'follow'`
 * so a public host cannot bounce us onto a private address.
 */
export async function fetchPublicHttp(
  raw: string,
  init: RequestInit = {},
  options: FetchPublicHttpOptions = {}
): Promise<Response> {
  const maxHops = options.maxHops ?? 4;
  const timeoutMs = options.timeoutMs ?? 15_000;
  let current = await assertPublicHttpUrl(raw, options);

  for (let hop = 0; hop < maxHops; hop++) {
    const signal = init.signal ?? AbortSignal.timeout(timeoutMs);
    const res = await fetch(current.toString(), {
      ...init,
      redirect: 'manual',
      signal,
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        throw new UnsafeOutboundUrlError('Redirect missing Location', 'bad_redirect');
      }
      current = await assertPublicHttpUrl(new URL(location, current).toString(), options);
      continue;
    }

    return res;
  }

  throw new UnsafeOutboundUrlError('Too many redirects', 'too_many_redirects');
}
