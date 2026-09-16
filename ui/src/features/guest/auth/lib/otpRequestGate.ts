const pendingOtpRequests = new Map<string, Promise<unknown>>();

/**
 * Coalesces concurrent OTP sends for the same normalized email. The Supabase
 * server remains the rate-limit authority; this prevents duplicate browser
 * requests caused by rapid clicks or multiple mounted auth surfaces.
 */
export function sendOtpSingleFlight<T>(email: string, send: () => Promise<T>): Promise<T> {
  const key = email.trim().toLowerCase();
  const pending = pendingOtpRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = send().finally(() => {
    if (pendingOtpRequests.get(key) === request) {
      pendingOtpRequests.delete(key);
    }
  });
  pendingOtpRequests.set(key, request);
  return request;
}
