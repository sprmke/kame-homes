/**
 * An edge call that answered with a status the query reporter must see.
 *
 * `reportQueryError` decides fault vs outcome from `error.status`: a 4xx is the handler
 * answering correctly, a 5xx or transport failure is a fault. Helpers that unwrap the
 * `{ success, error }` envelope used to throw a bare `Error`, so an expected 404 (a wrong
 * guest-trip link) or 400 (an invalid date range) landed in Sentry as a crash to fix.
 */
export class EdgeResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'EdgeResponseError';
    this.status = status;
  }
}
