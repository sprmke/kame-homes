/**
 * Marketing Studio URL state for the Library → Editor split.
 *
 *   ?tab=design                                  Library (home of the tab)
 *   ?tab=design&item=<uuid>                      Editor on a saved design
 *   ?tab=design&item=new&from=<ref>&size=<fmt>   Editor on an unsaved draft
 *   ?tab=generate&item=<uuid>                    AI Studio conversation
 *   ?tab=generate&item=new&output=<post|image|video>  New AI creation (step 2)
 *
 * A draft is not stored until the host changes something; the first save swaps
 * `item=new` for the new id in place (no extra history entry).
 */

export const ITEM_PARAM = 'item';
export const FROM_PARAM = 'from';
export const SIZE_PARAM = 'size';
export const NEW_ITEM = 'new';
export const OUTPUT_PARAM = 'output';

/** What AI Studio makes. Ids match the server (`image` = Photo, `video` = Clip). */
export const AI_STUDIO_OUTPUTS = ['post', 'image', 'video'] as const;
export type AiStudioOutput = (typeof AI_STUDIO_OUTPUTS)[number];

export function isAiStudioOutput(value: unknown): value is AiStudioOutput {
  return (AI_STUDIO_OUTPUTS as readonly unknown[]).includes(value);
}

/** The output of a new AI creation (`item=new&output=…`); null when absent or unknown. */
export function readAiOutput(params: URLSearchParams): AiStudioOutput | null {
  const value = params.get(OUTPUT_PARAM);
  return isAiStudioOutput(value) ? value : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRESET_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SIZE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Where a new design starts from. */
export type MarketingTemplateRef =
  | { kind: 'preset'; id: string }
  | { kind: 'template'; id: string }
  | { kind: 'blank' }
  | { kind: 'collage' };

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function parseTemplateRef(value: string | null | undefined): MarketingTemplateRef | null {
  if (!value) return null;
  if (value === 'blank') return { kind: 'blank' };
  if (value === 'collage') return { kind: 'collage' };
  if (value.startsWith('preset:')) {
    const id = value.slice('preset:'.length);
    return PRESET_ID_RE.test(id) ? { kind: 'preset', id } : null;
  }
  if (value.startsWith('tpl:')) {
    const id = value.slice('tpl:'.length);
    return isUuid(id) ? { kind: 'template', id } : null;
  }
  return null;
}

export function formatTemplateRef(ref: MarketingTemplateRef): string {
  switch (ref.kind) {
    case 'preset':
      return `preset:${ref.id}`;
    case 'template':
      return `tpl:${ref.id}`;
    default:
      return ref.kind;
  }
}

export function templateRefEquals(
  a: MarketingTemplateRef | null,
  b: MarketingTemplateRef | null
): boolean {
  if (!a || !b) return a === b;
  return formatTemplateRef(a) === formatTemplateRef(b);
}

export type MarketingStudioItemState =
  | { mode: 'library' }
  | { mode: 'saved'; id: string }
  | { mode: 'draft'; from: MarketingTemplateRef | null; size: string | null };

export function readItemState(params: URLSearchParams): MarketingStudioItemState {
  const item = params.get(ITEM_PARAM);
  if (item === NEW_ITEM) {
    const size = params.get(SIZE_PARAM);
    return {
      mode: 'draft',
      from: parseTemplateRef(params.get(FROM_PARAM)),
      size: size && SIZE_RE.test(size) ? size : null,
    };
  }
  if (isUuid(item)) return { mode: 'saved', id: item };
  return { mode: 'library' };
}

export function clearItemParams(params: URLSearchParams): void {
  params.delete(ITEM_PARAM);
  params.delete(FROM_PARAM);
  params.delete(SIZE_PARAM);
  params.delete(OUTPUT_PARAM);
}

export function applyOpenItem(params: URLSearchParams, id: string): void {
  clearItemParams(params);
  params.set(ITEM_PARAM, id);
}

export function applyStartDraft(
  params: URLSearchParams,
  input: { from: MarketingTemplateRef | null; size?: string | null }
): void {
  clearItemParams(params);
  params.set(ITEM_PARAM, NEW_ITEM);
  if (input.from) params.set(FROM_PARAM, formatTemplateRef(input.from));
  if (input.size && SIZE_RE.test(input.size)) params.set(SIZE_PARAM, input.size);
}

export function applyStartAiSession(params: URLSearchParams, output: AiStudioOutput): void {
  clearItemParams(params);
  params.set(ITEM_PARAM, NEW_ITEM);
  params.set(OUTPUT_PARAM, output);
}

/** Location state marking an editor entry pushed from the Library (so Back can pop it). */
export const LIBRARY_ENTRY_STATE_KEY = 'marketingLibraryEntry';

export function cameFromLibrary(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as Record<string, unknown>)[LIBRARY_ENTRY_STATE_KEY] === true
  );
}

/** Location state asking the editor to open its AI panel on arrival (Library "AI" start). */
export const OPEN_AI_STATE_KEY = 'marketingOpenAi';

export function wantsOpenAi(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as Record<string, unknown>)[OPEN_AI_STATE_KEY] === true
  );
}
