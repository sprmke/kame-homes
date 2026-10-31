import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import autoprefixer from 'autoprefixer';
import postcssImport from 'postcss-import';
import tailwindcss from 'tailwindcss';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Design editor only — never apply Blueprint globals to the admin shell. */
export const POLOTNO_EDITOR_SCOPE = '.polotno-studio-root';

export const POLOTNO_BLUEPRINT_ENTRY = path.resolve(
  __dirname,
  './src/features/dashboard/marketing/styles/polotno-blueprint.css'
);

const BLUEPRINT_SOURCE_MARKERS = [
  '@blueprintjs/core/lib/css/blueprint.css',
  '@blueprintjs/icons/lib/css/blueprint-icons.css',
];

const KEYFRAME_RULE_NAMES = new Set([
  'keyframes',
  '-webkit-keyframes',
  '-moz-keyframes',
  '-o-keyframes',
  '-ms-keyframes',
]);

export function isPolotnoBlueprintEntry(file) {
  if (!file) return false;
  const normalized = file.replace(/\\/g, '/');
  return normalized.includes('polotno-blueprint.css');
}

export function isBlueprintSourceStylesheet(file) {
  if (!file) return false;
  const normalized = file.replace(/\\/g, '/');
  return BLUEPRINT_SOURCE_MARKERS.some((fragment) => normalized.includes(fragment));
}

/** Drop Blueprint global resets; keep .bp5-* and icon font rules only. */
export function shouldScopeBlueprintSelector(selector) {
  const s = selector.trim();

  if (s.includes(POLOTNO_EDITOR_SCOPE)) return false;

  if (s === 'html' || s === 'body') return false;
  if (s === '*' || s.startsWith('*::')) return false;
  if (s === ':focus' || s === '.bp5-dark :focus') return false;
  if (/^::(moz-)?selection/.test(s)) return false;

  const bareElement =
    /^(p|small|strong|label|code|pre|blockquote|hr|ol|ul|li|table|th|td|form)(\W|$)/.test(s);
  if (bareElement && !s.includes('.bp5')) return false;

  if (/^a(\W|$)/.test(s) && !s.includes('.bp5')) return false;

  return s.includes('.bp5') || s.includes('blueprint-icons');
}

export function scopeBlueprintSelector(selector) {
  return `${POLOTNO_EDITOR_SCOPE} ${selector}`;
}

/** Scope Blueprint to the design editor; strip global html/body/:focus resets. */
export function postcssBlueprintScope() {
  return {
    postcssPlugin: 'postcss-blueprint-scope',
    Rule(rule) {
      if (rule.parent?.type === 'atrule' && KEYFRAME_RULE_NAMES.has(rule.parent.name)) {
        return;
      }

      const scopedSelectors = rule.selectors
        .map((selector) =>
          shouldScopeBlueprintSelector(selector) ? scopeBlueprintSelector(selector) : null
        )
        .filter(Boolean);

      if (scopedSelectors.length === 0) {
        rule.remove();
        return;
      }

      rule.selectors = scopedSelectors;
    },
  };
}
postcssBlueprintScope.postcss = true;

export async function buildScopedPolotnoBlueprintCss(from = POLOTNO_BLUEPRINT_ENTRY) {
  const postcss = (await import('postcss')).default;
  const entrySource = fs.readFileSync(from, 'utf8');
  const result = await postcss([postcssImport(), postcssBlueprintScope(), autoprefixer]).process(
    entrySource,
    { from }
  );

  return result.css;
}

export async function scopeBlueprintCss(source, from) {
  const postcss = (await import('postcss')).default;
  const result = await postcss([postcssBlueprintScope(), autoprefixer]).process(source, { from });
  return result.css;
}

export default (ctx) => {
  if (ctx.file && isPolotnoBlueprintEntry(ctx.file)) {
    return {
      plugins: [postcssImport(), postcssBlueprintScope(), autoprefixer],
    };
  }

  if (ctx.file && isBlueprintSourceStylesheet(ctx.file)) {
    return {
      plugins: [postcssBlueprintScope(), autoprefixer],
    };
  }

  return {
    plugins: [tailwindcss, autoprefixer],
  };
};
