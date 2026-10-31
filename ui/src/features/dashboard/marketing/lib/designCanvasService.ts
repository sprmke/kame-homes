import {
  type Canvas,
  FabricImage,
  Point,
  Rect,
  Textbox,
  type FabricObjectProps,
  type SerializedObjectProps,
  type TMat2D,
} from 'fabric';

import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';

type CanvasTemplateSize = { width: number; height: number };

type CanvasPreviewState = CanvasTemplateSize & {
  displayWidth: number;
  displayHeight: number;
  viewportTransform: TMat2D;
};

const canvasTemplateSize = new WeakMap<Canvas, CanvasTemplateSize>();
const canvasPreviewState = new WeakMap<Canvas, CanvasPreviewState>();

export function registerCanvasTemplateSize(canvas: Canvas, width: number, height: number) {
  canvasTemplateSize.set(canvas, { width, height });
}

async function loadPhoto(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const LOCKED: Partial<FabricObjectProps> = {
  selectable: false,
  evented: false,
  hasControls: false,
};

const EDITABLE: Partial<FabricObjectProps> = {
  selectable: true,
  evented: true,
  hasControls: true,
};

export async function addBackgroundPhoto(
  canvas: Canvas,
  binding: DesignBinding,
  width: number,
  height: number
) {
  if (binding.propertyPhoto) {
    try {
      const imgEl = await loadPhoto(binding.propertyPhoto);
      const image = new FabricImage(imgEl, {
        ...LOCKED,
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
      });
      const scale = Math.max(width / image.width!, height / image.height!);
      image.set({
        scaleX: scale,
        scaleY: scale,
        left: (width - image.width! * scale) / 2,
        top: (height - image.height! * scale) / 2,
      });
      image.set('name', 'background-photo');
      canvas.add(image);
    } catch {
      canvas.add(
        new Rect({
          ...LOCKED,
          left: 0,
          top: 0,
          width,
          height,
          fill: '#78716c',
        })
      );
    }
  } else {
    canvas.add(
      new Rect({
        ...LOCKED,
        left: 0,
        top: 0,
        width,
        height,
        fill: '#78716c',
      })
    );
  }

  canvas.add(
    new Rect({
      ...LOCKED,
      name: 'background-overlay',
      left: 0,
      top: 0,
      width,
      height,
      fill: 'rgba(15, 23, 42, 0.42)',
    })
  );
}

export function addEditableText(
  canvas: Canvas,
  opts: {
    name: string;
    text: string;
    left: number;
    top: number;
    width: number;
    fontSize: number;
    fill: string;
    fontWeight?: number | string;
    textAlign?: 'left' | 'center' | 'right';
    stroke?: string;
    strokeWidth?: number;
  }
) {
  const textbox = new Textbox(opts.text, {
    ...EDITABLE,
    name: opts.name,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    fontSize: opts.fontSize,
    fill: opts.fill,
    fontWeight: opts.fontWeight ?? 700,
    textAlign: opts.textAlign ?? 'center',
    stroke: opts.stroke,
    strokeWidth: opts.strokeWidth ?? 0,
    splitByGrapheme: true,
    editable: true,
  });
  canvas.add(textbox);
  return textbox;
}

export function addPill(
  canvas: Canvas,
  opts: {
    name: string;
    text: string;
    left: number;
    top: number;
    width: number;
    height: number;
    fill: string;
    textFill?: string;
    fontSize?: number;
  }
) {
  const pill = new Rect({
    ...EDITABLE,
    name: `${opts.name}-bg`,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    rx: opts.height / 2,
    ry: opts.height / 2,
    fill: opts.fill,
  });
  const label = new Textbox(opts.text, {
    ...EDITABLE,
    name: `${opts.name}-text`,
    left: opts.left,
    top: opts.top + opts.height / 2 - (opts.fontSize ?? 26) / 2 - 4,
    width: opts.width,
    fontSize: opts.fontSize ?? 26,
    fill: opts.textFill ?? '#ffffff',
    fontWeight: 700,
    textAlign: 'center',
    editable: true,
  });
  canvas.add(pill, label);
}

export function addSlotCard(
  canvas: Canvas,
  opts: {
    name: string;
    left: number;
    top: number;
    size: number;
    dateNum: string;
    dayName: string;
  }
) {
  const card = new Rect({
    ...EDITABLE,
    name: `${opts.name}-card`,
    left: opts.left,
    top: opts.top,
    width: opts.size,
    height: opts.size,
    rx: 20,
    ry: 20,
    fill: '#ffffff',
  });
  const dateText = new Textbox(opts.dateNum, {
    ...EDITABLE,
    name: `${opts.name}-date`,
    left: opts.left,
    top: opts.top + opts.size * 0.22,
    width: opts.size,
    fontSize: Math.round(opts.size * 0.34),
    fill: '#7c4a2d',
    fontWeight: 800,
    textAlign: 'center',
    editable: true,
  });
  const dayText = new Textbox(opts.dayName, {
    ...EDITABLE,
    name: `${opts.name}-day`,
    left: opts.left,
    top: opts.top + opts.size * 0.62,
    width: opts.size,
    fontSize: Math.round(opts.size * 0.11),
    fill: '#7c4a2d',
    fontWeight: 700,
    textAlign: 'center',
    editable: true,
  });
  canvas.add(card, dateText, dayText);
}

export function addBanner(
  canvas: Canvas,
  opts: {
    name: string;
    text: string;
    left: number;
    top: number;
    width: number;
    height: number;
    fill: string;
    fontSize?: number;
  }
) {
  const banner = new Rect({
    ...EDITABLE,
    name: `${opts.name}-bg`,
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
    fill: opts.fill,
  });
  const label = new Textbox(opts.text, {
    ...EDITABLE,
    name: `${opts.name}-text`,
    left: opts.left + 24,
    top: opts.top + opts.height / 2 - (opts.fontSize ?? 32) / 2,
    width: opts.width - 48,
    fontSize: opts.fontSize ?? 32,
    fill: '#ffffff',
    fontWeight: 800,
    textAlign: 'center',
    editable: true,
  });
  canvas.add(banner, label);
}

export function getDesignCanvasSize(
  canvas: Canvas,
  fallbackWidth: number,
  fallbackHeight: number
): { width: number; height: number } {
  return canvasTemplateSize.get(canvas) ?? { width: fallbackWidth, height: fallbackHeight };
}

function applyCanvasContainerStyles(canvas: Canvas, width: number, height: number) {
  const container = canvas.elements?.container;
  if (!container) return;
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = 'hidden';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.lineHeight = '0';
  container.style.position = 'relative';
}

function applyPreviewViewport(
  canvas: Canvas,
  templateWidth: number,
  templateHeight: number,
  scale: number
) {
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setDimensions({ width: templateWidth, height: templateHeight }, { backstoreOnly: true });
  canvas.zoomToPoint(new Point(0, 0), scale);
}

export function fitCanvasPreview(
  canvas: Canvas,
  templateWidth: number,
  templateHeight: number,
  containerWidth: number,
  containerHeight: number
): { scale: number; width: number; height: number } {
  const padding = 24;
  const availableWidth = Math.max(containerWidth - padding, 1);
  const availableHeight = Math.max(containerHeight - padding, 1);
  const scale = Math.min(availableWidth / templateWidth, availableHeight / templateHeight, 1);
  const displayWidth = Math.round(templateWidth * scale);
  const displayHeight = Math.round(templateHeight * scale);

  applyPreviewViewport(canvas, templateWidth, templateHeight, scale);
  canvas.setDimensions(
    { width: `${displayWidth}px`, height: `${displayHeight}px` },
    { cssOnly: true }
  );
  applyCanvasContainerStyles(canvas, displayWidth, displayHeight);
  canvas.calcOffset();
  canvas.requestRenderAll();

  canvasPreviewState.set(canvas, {
    width: templateWidth,
    height: templateHeight,
    displayWidth,
    displayHeight,
    viewportTransform: canvas.viewportTransform.slice() as TMat2D,
  });

  return { scale, width: displayWidth, height: displayHeight };
}

export async function exportCanvasBlob(
  canvas: Canvas,
  width: number,
  height: number
): Promise<Blob> {
  const preview = canvasPreviewState.get(canvas);

  canvas.discardActiveObject();
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.setDimensions({ width, height });
  applyCanvasContainerStyles(canvas, width, height);
  canvas.calcOffset();
  canvas.requestRenderAll();

  const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
  const res = await fetch(dataUrl);
  const blob = await res.blob();

  if (preview) {
    canvas.setViewportTransform(preview.viewportTransform);
    canvas.setDimensions({ width: preview.width, height: preview.height }, { backstoreOnly: true });
    canvas.setDimensions(
      { width: `${preview.displayWidth}px`, height: `${preview.displayHeight}px` },
      { cssOnly: true }
    );
    applyCanvasContainerStyles(canvas, preview.displayWidth, preview.displayHeight);
  }

  canvas.calcOffset();
  canvas.requestRenderAll();

  return blob;
}

export async function addImageFromFile(canvas: Canvas, file: File) {
  const url = URL.createObjectURL(file);
  try {
    const imgEl = await loadPhoto(url);
    const { width, height } = getDesignCanvasSize(canvas, canvas.getWidth(), canvas.getHeight());
    const image = new FabricImage(imgEl, {
      ...EDITABLE,
      name: 'uploaded-image',
      left: width / 2 - 120,
      top: height / 2 - 120,
    });
    image.scaleToWidth(240);
    canvas.add(image);
    canvas.setActiveObject(image);
    canvas.requestRenderAll();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function addBlankText(canvas: Canvas) {
  const { width, height } = getDesignCanvasSize(canvas, canvas.getWidth(), canvas.getHeight());
  const text = addEditableText(canvas, {
    name: 'custom-text',
    text: 'Edit text',
    left: width * 0.15,
    top: height * 0.4,
    width: width * 0.7,
    fontSize: 48,
    fill: '#ffffff',
    stroke: '#5c3d2e',
    strokeWidth: 2,
    textAlign: 'center',
  });
  canvas.setActiveObject(text);
  canvas.requestRenderAll();
}

export function deleteActiveObjects(canvas: Canvas) {
  const active = canvas.getActiveObjects();
  if (!active.length) return;
  active.forEach((obj) => canvas.remove(obj));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

export async function loadCanvasFromJson(canvas: Canvas, json: Record<string, unknown>) {
  await canvas.loadFromJSON(json);
  canvas.getObjects().forEach((obj) => {
    const name = obj.get('name') as string | undefined;
    const locked = name === 'background-photo' || name === 'background-overlay';
    obj.set({
      selectable: !locked,
      evented: !locked,
      hasControls: !locked,
      editable: obj.type === 'textbox',
    });
  });
  canvas.requestRenderAll();
}

export type SerializedFabricJson = {
  version?: string;
  objects?: SerializedObjectProps[];
  background?: string;
};

export function serializeCanvas(canvas: Canvas): SerializedFabricJson {
  return canvas.toJSON() as SerializedFabricJson;
}
