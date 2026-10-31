export type ComposerFocusMode = 'reply' | 'edit';

/** Focus the chat composer after reply/edit — runs after the dropdown closes. */
export function focusComposerInput(
  element: HTMLTextAreaElement | null | undefined,
  mode: ComposerFocusMode
) {
  if (!element) return;

  requestAnimationFrame(() => {
    element.focus({ preventScroll: true });
    if (mode === 'edit') {
      const len = element.value.length;
      element.setSelectionRange(len, len);
    }
  });
}
