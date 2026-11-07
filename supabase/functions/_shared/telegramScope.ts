/** Scope ref used by every Telegram send path (property id string is a shorthand). */
export type TelegramScopeRef = {
  propertyId?: string | null;
  parkingId?: string | null;
};

/** Normalizes the loose scope argument the send helpers accept. */
export function normalizeTelegramScope(
  scope?: TelegramScopeRef | string | null
): { propertyId: string | null; parkingId: string | null } {
  if (typeof scope === 'string') return { propertyId: scope, parkingId: null };
  if (scope && typeof scope === 'object') {
    return { propertyId: scope.propertyId ?? null, parkingId: scope.parkingId ?? null };
  }
  return { propertyId: null, parkingId: null };
}
