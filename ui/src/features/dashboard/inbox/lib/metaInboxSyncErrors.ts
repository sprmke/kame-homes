/** User-facing copy for Meta inbox sync errors stored on the connection row. */
export function friendlyMetaSyncError(message: string | null | undefined): string | null {
  if (!message) return null;
  if (message.startsWith('Sync failed:')) {
    return 'Could not load all conversations. Try Reconnect in Channels.';
  }
  return message;
}

/** Hide internal sync errors from the Channels connection card. */
export function isMetaSyncConnectionError(message: string | null | undefined): boolean {
  return !!message?.startsWith('Sync failed:');
}
