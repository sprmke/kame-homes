/** Map Meta Graph send errors to operator-friendly messages. */

export function friendlyMetaSendError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('outside the allowed window') || lower.includes('messaging window')) {
    return 'Messaging window expired — guest must message again before you can reply.';
  }
  if (lower.includes('(#10)') || lower.includes('does not have permission')) {
    return 'Missing Meta permission — reconnect the Page or complete App Review.';
  }
  if (lower.includes('(#551)') || lower.includes('person is not available')) {
    return 'This person is not available to receive messages.';
  }
  if (lower.includes('(#100)') && lower.includes('recipient')) {
    return 'Invalid recipient — try syncing conversations from Channels.';
  }
  if (lower.includes('rate limit') || lower.includes('(#4)')) {
    return 'Meta rate limit — wait a moment and try again.';
  }
  if (lower.includes('access token') || lower.includes('session has expired')) {
    return 'Meta session expired — reconnect Facebook in Channels.';
  }
  return raw;
}
