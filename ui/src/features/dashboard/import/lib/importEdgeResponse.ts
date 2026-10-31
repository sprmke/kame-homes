/**
 * Shared edge-response helpers for import wizard mutations.
 * Kong 502/503 bodies are often empty or non-JSON while the local edge runtime restarts.
 */

export type ImportEdgeEnvelope<T> = {
  success?: boolean;
  error?: string;
  data?: T;
};

export async function readImportEdgeJson<T>(res: Response): Promise<ImportEdgeEnvelope<T>> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as ImportEdgeEnvelope<T>;
  } catch {
    return {};
  }
}

export function importEdgeErrorMessage(
  json: Pick<ImportEdgeEnvelope<unknown>, 'error'>,
  status: number,
  fallback = 'Request failed'
): string {
  const raw = (json.error ?? '').trim();

  if (status === 401 || status === 403) {
    return 'You do not have permission to import for this property.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is restarting. Please try again in a moment.';
  }
  if (status >= 500) {
    return raw || 'Something went wrong on our side. Please try again.';
  }
  return raw || (status ? `${fallback} (error ${status})` : fallback);
}
