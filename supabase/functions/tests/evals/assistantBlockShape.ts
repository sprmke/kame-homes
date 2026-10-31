/**
 * Block-shape eval helpers: load `assistant_block_shape.jsonl` rows + their tool-result fixtures,
 * run the deterministic shaping pipeline, and score the result against the row's expectations.
 *
 * Offline (CI): `modelBlocks` stands in for the model's synth output.
 * Live (`bun run eval:ai -- --suite blocks`): the real model produces the blocks, then the same
 * `scoreBlockShape` runs, so the two modes measure the same contract.
 */
import { shapeAndFinalizeForEval } from '../../_shared/dashboardAssistantResponseShape.ts';
import type { ChatBlock } from '../../_shared/dashboardAssistantSafetyGuard.ts';
import { readJsonl } from './evalDatasets.ts';

export type BlockShapeExpect = {
  /** First "content" block type (text / quick_actions / activity / task_plan are skipped). */
  primaryBlock?: string;
  allowedBlocks?: string[];
  forbidBlocks?: string[];
  maxChips?: number;
  maxTextChars?: number;
  maxTextBlocks?: number;
  hasText?: boolean;
  tableHasColumn?: string;
  mustMentionAny?: string[];
  mustNotMention?: string[];
  chipsMustNotInclude?: string[];
  /** Regex source tested against every chip label. */
  chipsMustNotMatch?: string;
};

export type BlockShapeRow = {
  id: string;
  message: string;
  module: string;
  /** `file.json#key` references under fixtures/assistant/. */
  fixtures: string[];
  modelBlocks: unknown[];
  draftText?: string;
  /** Live suite uses the real model unless `canned` (safety / empty-draft rows). */
  live?: 'model' | 'canned';
  /** Set while the expected shape depends on a later phase; offline scoring is skipped. */
  pending?: 'phase-2' | 'phase-3' | 'phase-4';
  expect: BlockShapeExpect;
};

export type Fixture = { toolName: string; data: unknown };

const fixtureCache = new Map<string, Record<string, Fixture>>();

export async function loadFixtureFile(file: string): Promise<Record<string, Fixture>> {
  const cached = fixtureCache.get(file);
  if (cached) return cached;
  const url = new URL(`./fixtures/assistant/${file}`, import.meta.url);
  const parsed = JSON.parse(await Deno.readTextFile(url)) as Record<string, Fixture>;
  fixtureCache.set(file, parsed);
  return parsed;
}

export async function resolveFixtures(refs: string[]): Promise<Fixture[]> {
  const out: Fixture[] = [];
  for (const ref of refs) {
    const [file, key] = ref.split('#');
    if (!file || !key) {
      throw new Error(`Bad fixture ref "${ref}" (expected file.json#key)`);
    }
    const table = await loadFixtureFile(file);
    const fixture = table[key];
    if (!fixture) throw new Error(`Fixture ${ref} not found`);
    out.push(fixture);
  }
  return out;
}

export async function readBlockShapeRows(): Promise<BlockShapeRow[]> {
  return await readJsonl<BlockShapeRow>('assistant_block_shape.jsonl');
}

/** Mirrors the handler: grounding text is the serialized tool results plus the user turn. */
export function groundingTextFor(message: string, toolResults: unknown[]): string {
  return `${message}\n${JSON.stringify(toolResults)}`;
}

const NON_CONTENT_TYPES = new Set(['text', 'quick_actions', 'activity_timeline', 'task_plan']);

export function primaryBlockType(blocks: ChatBlock[]): string {
  const content = blocks.find((block) => !NON_CONTENT_TYPES.has(block.type));
  return content ? content.type : 'text';
}

export function chipLabels(blocks: ChatBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === 'quick_actions' ? block.actions.map((action) => action.label) : []
  );
}

export function textBlocks(blocks: ChatBlock[]): string[] {
  return blocks.flatMap((block) => (block.type === 'text' ? [block.text] : []));
}

const isStatusColumn = (col: string) => /^status$/i.test(col.trim());

/**
 * Strings the host actually reads. Excludes machine fields (`rowTargets`, ids, chip prompts) and
 * data_table Status cells, which the UI renders as a badge from the status code.
 */
export function hostVisibleText(blocks: ChatBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'text':
        parts.push(block.text);
        break;
      case 'quick_actions':
        parts.push(...block.actions.map((action) => action.label));
        break;
      case 'data_table': {
        parts.push(block.title, ...block.columns);
        for (const row of block.rows) {
          for (const [col, value] of Object.entries(row)) {
            if (!isStatusColumn(col)) parts.push(String(value));
          }
        }
        break;
      }
      case 'booking_card':
        parts.push(
          block.guestName,
          block.propertyName,
          block.checkIn,
          block.checkOut,
          block.status
        );
        if (block.balanceDue != null) {
          parts.push(`₱${Math.round(block.balanceDue).toLocaleString('en-US')} balance due`);
        }
        break;
      case 'file_list':
        parts.push(block.title);
        for (const file of block.files) {
          parts.push(file.label);
          const name = file.url.split('/').pop();
          if (name) parts.push(name);
        }
        break;
      case 'calendar': {
        const open = block.days.filter((day) => day.state === 'available').length;
        parts.push(block.title, `${open} open nights`);
        for (const day of block.days) {
          if (day.label) parts.push(day.label);
          if ('rate' in day && day.rate) parts.push(String(day.rate));
          if (day.state === 'blocked' || day.state === 'booked' || day.state === 'checkin') {
            parts.push(day.date);
          }
        }
        break;
      }
      case 'kpi':
        parts.push(block.label, block.value, block.delta?.value ?? '', block.delta?.label ?? '');
        break;
      case 'chart':
        parts.push(block.title);
        for (const series of block.series) {
          parts.push(series.name);
          for (const point of series.points) {
            parts.push(point.x, point.label ?? String(point.y));
          }
        }
        if (block.tableAlt) {
          parts.push(...block.tableAlt.columns);
          for (const row of block.tableAlt.rows) {
            parts.push(...Object.values(row).map((value) => String(value)));
          }
        }
        break;
      case 'comparison':
        parts.push(block.title, ...block.columns);
        for (const row of block.rows) {
          parts.push(row.label, row.before, row.after);
        }
        break;
      case 'checklist':
        parts.push(block.title, ...block.items.map((item) => item.label));
        break;
      case 'callout':
        parts.push(block.text);
        break;
      case 'timeline':
        parts.push(block.title);
        for (const item of block.items) {
          parts.push(item.at, item.label, item.detail ?? '', item.status ?? '', item.actor ?? '');
        }
        break;
      case 'stepper':
        parts.push(
          block.title,
          ...block.steps.map((step) => `${step.label} ${step.description ?? ''}`)
        );
        break;
      case 'activity_timeline':
      case 'task_plan':
        break;
      default: {
        // Generic blocks (stat_list, link_list, image, flow, ...): every string field.
        const { type: _type, ...rest } = block as Record<string, unknown>;
        parts.push(JSON.stringify(rest));
      }
    }
  }
  return parts.join('\n');
}

export type BlockShapeScore = { pass: boolean; failures: string[] };

export function scoreBlockShape(blocks: ChatBlock[], expect: BlockShapeExpect): BlockShapeScore {
  const failures: string[] = [];
  const types = blocks.map((block) => block.type);
  const serialized = hostVisibleText(blocks);
  const chips = chipLabels(blocks);
  const texts = textBlocks(blocks);

  if (expect.primaryBlock !== undefined) {
    const primary = primaryBlockType(blocks);
    if (primary !== expect.primaryBlock) {
      failures.push(`primary ${primary} (want ${expect.primaryBlock}); types=[${types.join(',')}]`);
    }
  }
  if (expect.allowedBlocks) {
    const stray = types.filter((type) => !expect.allowedBlocks!.includes(type));
    if (stray.length) failures.push(`disallowed blocks: ${stray.join(',')}`);
  }
  if (expect.forbidBlocks) {
    const present = types.filter((type) => expect.forbidBlocks!.includes(type));
    if (present.length) {
      failures.push(`forbidden blocks present: ${present.join(',')}`);
    }
  }
  if (expect.maxChips !== undefined && chips.length > expect.maxChips) {
    failures.push(`${chips.length} chips (max ${expect.maxChips})`);
  }
  if (expect.maxTextBlocks !== undefined && texts.length > expect.maxTextBlocks) {
    failures.push(`${texts.length} text blocks (max ${expect.maxTextBlocks})`);
  }
  if (expect.maxTextChars !== undefined) {
    const total = texts.reduce((sum, text) => sum + text.length, 0);
    if (total > expect.maxTextChars) {
      failures.push(`${total} text chars (max ${expect.maxTextChars})`);
    }
  }
  if (expect.hasText && !texts.some((text) => text.trim().length > 0)) {
    failures.push('no text block');
  }
  if (expect.tableHasColumn) {
    const ok = blocks.some(
      (block) =>
        block.type === 'data_table' &&
        block.columns.some(
          (col) => col.trim().toLowerCase() === expect.tableHasColumn!.toLowerCase()
        )
    );
    if (!ok) failures.push(`no data_table column "${expect.tableHasColumn}"`);
  }
  if (
    expect.mustMentionAny &&
    !expect.mustMentionAny.some((needle) => serialized.includes(needle))
  ) {
    failures.push(`mentions none of: ${expect.mustMentionAny.join(' | ')}`);
  }
  for (const needle of expect.mustNotMention ?? []) {
    if (serialized.includes(needle)) {
      failures.push(`mentions forbidden "${needle}"`);
    }
  }
  for (const label of expect.chipsMustNotInclude ?? []) {
    if (chips.includes(label)) {
      failures.push(`chip "${label}" should be removed`);
    }
  }
  if (expect.chipsMustNotMatch) {
    const re = new RegExp(expect.chipsMustNotMatch, 'i');
    const bad = chips.filter((label) => re.test(label));
    if (bad.length) {
      failures.push(`chips match /${expect.chipsMustNotMatch}/: ${bad.join(' | ')}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

/** Offline run of one row: fixtures → pipeline → score. */
export async function runBlockShapeRowOffline(
  row: BlockShapeRow
): Promise<BlockShapeScore & { blocks: ChatBlock[] }> {
  const fixtures = await resolveFixtures(row.fixtures);
  const toolResults = fixtures.map((fixture) => fixture.data);
  const blocks = shapeAndFinalizeForEval({
    modelBlocks: row.modelBlocks,
    draftText: row.draftText ?? null,
    toolResults,
    groundingText: groundingTextFor(row.message, toolResults),
    userMessage: row.message,
  });
  return { ...scoreBlockShape(blocks, row.expect), blocks };
}
