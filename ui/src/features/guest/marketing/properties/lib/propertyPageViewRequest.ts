export interface PropertyPageViewPayload {
  propertyId: string;
  sessionId: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/**
 * Not `navigator.sendBeacon`: a beacon is always sent with credentials, and the edge CORS
 * response has no `Access-Control-Allow-Credentials`, so browsers drop it. A `keepalive`
 * fetch survives page unload the same way and can omit credentials.
 */
export function buildPropertyPageViewRequest(
  functionsUrl: string,
  anonKey: string,
  payload: PropertyPageViewPayload
): [string, RequestInit] {
  return [
    `${functionsUrl.replace(/\/$/, '')}/property-page-view`,
    {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: {
        'content-type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    },
  ];
}
