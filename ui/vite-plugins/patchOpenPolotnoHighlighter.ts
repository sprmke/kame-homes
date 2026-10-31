import type { Plugin } from 'vite';

const OPENPOLOTNO_CANVAS_BUNDLE =
  /openpolotno[/\\]dist[/\\]canvas[/\\](element|page|workspace|workspace-canvas)\.js$/;

const HIGHLIGHTER_PATTERN =
  /var Highlighter = observer7\(\s*\(\{ element \}\) => React13\.createElement\(Rect6, \{\s*name: "highlighter",\s*x: element\.a\.x,\s*y: element\.a\.y,\s*rotation: element\.a\.rotation,\s*width: element\.a\.width,\s*height: element\.a\.height,\s*listening: false,\s*strokeScaleEnabled: false,\s*\.\.\.highlighterStyle\s*\}\)\s*\);/;

const PATCHED_HIGHLIGHTER = `var Highlighter = observer7(({ element }) => {
  const a = element.a;
  let x = a.x;
  let y = a.y;
  let rotation = a.rotation;
  let width = a.width;
  let height = a.height;
  const elementId = element.id;
  const pageId = element.page?.id;
  if (elementId && pageId) {
    const stage = Konva14.stages.find((s) => s.getAttr("pageId") === pageId);
    const node = stage?.findOne("#" + elementId);
    if (node) {
      x = node.x();
      y = node.y();
      rotation = node.rotation();
      width = node.width() * Math.abs(node.scaleX());
      const measuredHeight =
        typeof node.getHeight === "function" ? node.getHeight() : node.height();
      height = measuredHeight * Math.abs(node.scaleY());
    }
  }
  return React13.createElement(Rect6, {
    name: "highlighter",
    x,
    y,
    rotation,
    width,
    height,
    listening: false,
    strokeScaleEnabled: false,
    ...highlighterStyle
  });
});`;

/** Patch OpenPolotno hover chrome to use live Konva node bounds (matches selection box). */
export function applyOpenPolotnoHighlighterPatch(code: string): string {
  return code.replace(HIGHLIGHTER_PATTERN, PATCHED_HIGHLIGHTER);
}

function shouldPatchOpenPolotnoCanvasFile(id: string): boolean {
  return OPENPOLOTNO_CANVAS_BUNDLE.test(id.replace(/\\/g, '/'));
}

/**
 * OpenPolotno hover chrome reads element.a.width/height. Auto-height text keeps height at 0
 * in the model while Konva lays out the real box — hover shows a flat top line only.
 * Selection uses Transformer node bounds, so it looks correct.
 */
export function patchOpenPolotnoHighlighter(): Plugin {
  return {
    name: 'patch-openpolotno-highlighter',
    enforce: 'pre',
    transform(code, id) {
      if (!shouldPatchOpenPolotnoCanvasFile(id)) return null;

      const patched = applyOpenPolotnoHighlighterPatch(code);
      if (patched === code) return null;

      return { code: patched, map: null };
    },
  };
}

/** Runs during optimizeDeps pre-bundling (dev) so openpolotno can stay pre-bundled. */
export function openPolotnoHighlighterEsbuildPlugin() {
  return {
    name: 'patch-openpolotno-highlighter-esbuild',
    setup(build: {
      onLoad: (
        options: { filter: RegExp },
        callback: (args: { path: string }) => Promise<{ contents: string; loader: 'js' } | null>
      ) => void;
    }) {
      build.onLoad({ filter: OPENPOLOTNO_CANVAS_BUNDLE }, async (args) => {
        const { readFile } = await import('node:fs/promises');
        const contents = await readFile(args.path, 'utf8');
        return {
          contents: applyOpenPolotnoHighlighterPatch(contents),
          loader: 'js',
        };
      });
    },
  };
}
