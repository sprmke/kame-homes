import type { VoiceReceptionistAction } from './voiceReceptionistApi';

const ACTION_TYPES = new Set<VoiceReceptionistAction['type']>([
  'open_text_chat',
  'open_booking',
  'open_calendar',
  'open_stay_guide',
  'open_property',
]);

export function sanitizeVoiceReceptionistActions(input: unknown): VoiceReceptionistAction[] {
  if (!Array.isArray(input)) return [];
  const actions: VoiceReceptionistAction[] = [];
  for (const value of input) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const type = row.type as VoiceReceptionistAction['type'];
    const label = typeof row.label === 'string' ? row.label.trim().slice(0, 40) : '';
    const url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!ACTION_TYPES.has(type) || !label || !url.startsWith('/') || url.startsWith('//')) continue;
    actions.push({ type, label, url: url.slice(0, 500) });
    if (actions.length >= 3) break;
  }
  return actions;
}
