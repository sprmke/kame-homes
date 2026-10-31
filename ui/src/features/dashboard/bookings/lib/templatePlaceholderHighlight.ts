import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/** Match Telegram template editor highlight styling. */
export const TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS = 'template-token-highlight';

export const TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_PREVIEW =
  'rounded-sm bg-primary/15 font-medium text-primary';

export const TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS_EDIT =
  'rounded-sm bg-primary/15 font-medium text-primary [box-decoration-break:clone]';

const TOKEN_PATTERN = /\{\{[^}]+\}\}/g;
const TOKEN_TEST = /^\{\{[\w-]+\}\}$/;

export function extractPlaceholderKey(token: string): string | null {
  if (!TOKEN_TEST.test(token)) return null;
  return token.slice(2, -2).trim().replace(/-/g, '_');
}

export function isKnownTemplatePlaceholderToken(
  token: string,
  validKeys?: ReadonlySet<string>
): boolean {
  const key = extractPlaceholderKey(token);
  if (!key) return false;
  if (!validKeys || validKeys.size === 0) return true;
  return validKeys.has(key);
}

/** Wrap `{{tokens}}` in HTML for read-only display (standard template preview). */
export function highlightPlaceholdersInHtml(html: string, validKeys?: ReadonlySet<string>): string {
  return html.replace(TOKEN_PATTERN, (match) => {
    if (!isKnownTemplatePlaceholderToken(match, validKeys)) return match;
    return `<mark class="${TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS}">${match}</mark>`;
  });
}

export const TemplatePlaceholderHighlight = Extension.create({
  name: 'templatePlaceholderHighlight',

  addOptions() {
    return {
      validKeys: undefined as ReadonlySet<string> | undefined,
    };
  },

  addProseMirrorPlugins() {
    const validKeys = this.options.validKeys;
    return [
      new Plugin({
        key: new PluginKey('templatePlaceholderHighlight'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              const text = node.text;
              TOKEN_PATTERN.lastIndex = 0;
              let match: RegExpExecArray | null;
              while ((match = TOKEN_PATTERN.exec(text)) !== null) {
                const token = match[0];
                if (!isKnownTemplatePlaceholderToken(token, validKeys)) continue;
                const from = pos + match.index;
                const to = from + token.length;
                decorations.push(
                  Decoration.inline(from, to, {
                    class: TEMPLATE_PLACEHOLDER_HIGHLIGHT_CLASS,
                  })
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
