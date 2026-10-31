/** Apply CSS custom properties on an element (e.g. `:root` for portaled dialogs). */
export function applyBrandCssVariables(
  element: HTMLElement,
  variables: Record<string, string>
): () => void {
  const snapshot = new Map<string, string | null>();

  for (const [key, value] of Object.entries(variables)) {
    const prev = element.style.getPropertyValue(key);
    snapshot.set(key, prev || null);
    element.style.setProperty(key, value);
  }

  return () => {
    for (const key of Object.keys(variables)) {
      const prev = snapshot.get(key);
      if (prev) element.style.setProperty(key, prev);
      else element.style.removeProperty(key);
    }
  };
}
