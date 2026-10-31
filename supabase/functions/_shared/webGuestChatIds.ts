/** Shared IDs for guest web chat messages (avoids circular imports). */

export function buildWebThreadId(propertyId: string, guestUserId: string): string {
  return `web:${propertyId}:${guestUserId}`;
}

export function buildParkingWebThreadId(parkingId: string, guestUserId: string): string {
  return `web:parking:${parkingId}:${guestUserId}`;
}

export function buildWebMessageExternalId(): string {
  return `web:${crypto.randomUUID()}`;
}
