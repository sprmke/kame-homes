import { expect, type Page } from '@playwright/test';

export async function expectNoPageHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
        ),
      { message: 'document should not overflow the viewport horizontally' }
    )
    .toBe(true);
}

export async function expectNoUnnamedInteractiveControls(page: Page): Promise<void> {
  const unnamed = await page
    .locator('button:visible, a[href]:visible, input:not([type="hidden"]):visible, select:visible, textarea:visible')
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const html = element as HTMLElement;
        const control = element as HTMLInputElement;
        if (html.getAttribute('aria-hidden') === 'true') return [];
        const style = window.getComputedStyle(html);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return [];
        }
        if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') {
          return [];
        }
        const rect = html.getBoundingClientRect();
        if (rect.width <= 1 && rect.height <= 1) return [];
        const labelledBy = html.getAttribute('aria-labelledby');
        const labelledByText = labelledBy
          ? labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
              .join(' ')
              .trim()
          : '';
        const labelText =
          'labels' in control
            ? Array.from(control.labels ?? [])
                .map((label) => label.textContent?.trim() ?? '')
                .join(' ')
                .trim()
            : '';
        const name =
          html.getAttribute('aria-label')?.trim() ||
          labelledByText ||
          labelText ||
          html.getAttribute('title')?.trim() ||
          html.textContent?.trim() ||
          (control.type === 'submit' ? control.value.trim() : '');

        if (name) return [];
        return [
          `${html.tagName.toLowerCase()}${html.id ? `#${html.id}` : ''}${html.className ? `.${String(html.className).split(/\s+/).slice(0, 2).join('.')}` : ''}${control.name ? `[name=${control.name}]` : ''}`,
        ];
      })
    );

  expect(unnamed, `Unnamed interactive controls: ${unnamed.join(', ')}`).toEqual([]);
}
