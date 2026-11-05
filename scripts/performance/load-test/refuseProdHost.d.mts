/** Hostnames load tests must never hit (production + legacy prod). */
export declare const REFUSED_LOAD_TEST_HOSTS: ReadonlySet<string>;

/** Throws when `baseUrl` points at a refused production host. */
export declare function refuseProdLoadTestBaseUrl(baseUrl: string): void;
