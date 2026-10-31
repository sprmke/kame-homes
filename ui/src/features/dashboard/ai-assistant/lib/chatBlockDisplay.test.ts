import { describe, expect, it } from 'vitest';

import {
  humanizeAssistantStatusText,
  humanizeAssistantConfirmationCopy,
  hostFacingUserMessageText,
  dataTableRowCells,
  dataTableHasRows,
  dataTableCell,
  isCanvasWorthyBlock,
  canvasBlockTitle,
  canvasBlockSummary,
  dynamicFormValueDisplay,
  dynamicFormValuesToLines,
  dynamicFormWidthClass,
  assistantBubbleWidthClass,
  patchDynamicFormStatus,
  patchActionConfirmationStatus,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';

describe('humanizeAssistantStatusText', () => {
  it('humanizeAssistantStatusText is exported', () => {
    expect(typeof humanizeAssistantStatusText).toBe('function');
  });
});

describe('humanizeAssistantConfirmationCopy', () => {
  it('humanizeAssistantConfirmationCopy is exported', () => {
    expect(typeof humanizeAssistantConfirmationCopy).toBe('function');
  });
});

describe('hostFacingUserMessageText', () => {
  it('hostFacingUserMessageText is exported', () => {
    expect(typeof hostFacingUserMessageText).toBe('function');
  });
});

describe('dataTableRowCells', () => {
  it('dataTableRowCells is exported', () => {
    expect(typeof dataTableRowCells).toBe('function');
  });
});

describe('dataTableHasRows', () => {
  it('dataTableHasRows is exported', () => {
    expect(typeof dataTableHasRows).toBe('function');
  });
});

describe('dataTableCell', () => {
  it('dataTableCell is exported', () => {
    expect(typeof dataTableCell).toBe('function');
  });
});

describe('isCanvasWorthyBlock', () => {
  it('charts over 12 points and tables over 24 rows are canvas-worthy', () => {
    const chart = {
      type: 'chart' as const,
      title: 'Occupancy',
      kind: 'bar' as const,
      series: [
        {
          name: 'occ',
          points: Array.from({ length: 13 }, (_, i) => ({ x: String(i), y: i })),
        },
      ],
      tableAlt: { columns: ['x', 'y'], rows: [] },
    };
    const smallChart = { ...chart, series: [{ name: 'occ', points: [{ x: '1', y: 1 }] }] };
    expect(isCanvasWorthyBlock(chart)).toBe(true);
    expect(isCanvasWorthyBlock(smallChart)).toBe(false);
    expect(
      isCanvasWorthyBlock({
        type: 'data_table',
        title: 'Rows',
        columns: ['a'],
        rows: Array.from({ length: 25 }, () => ({ a: 1 })),
      })
    ).toBe(true);
    expect(
      isCanvasWorthyBlock({
        type: 'carousel',
        title: 'Items',
        items: Array.from({ length: 9 }, (_, i) => ({
          type: 'entity_card' as const,
          entityType: 'guest' as const,
          id: String(i),
          title: `Item ${i}`,
          facts: [],
        })),
      })
    ).toBe(true);
  });
});

describe('canvasBlockTitle', () => {
  it('canvasBlockTitle is exported', () => {
    expect(typeof canvasBlockTitle).toBe('function');
  });
});

describe('canvasBlockSummary', () => {
  it('canvasBlockSummary is exported', () => {
    expect(typeof canvasBlockSummary).toBe('function');
  });
});

describe('dynamicFormValueDisplay', () => {
  it('dynamicFormValueDisplay is exported', () => {
    expect(typeof dynamicFormValueDisplay).toBe('function');
  });
});

describe('dynamicFormValuesToLines', () => {
  it('dynamicFormValuesToLines is exported', () => {
    expect(typeof dynamicFormValuesToLines).toBe('function');
  });
});

describe('dynamicFormWidthClass', () => {
  it('dynamicFormWidthClass is exported', () => {
    expect(typeof dynamicFormWidthClass).toBe('function');
  });
});

describe('assistantBubbleWidthClass', () => {
  it('widens the bubble for chart, calendar, and carousel', () => {
    expect(assistantBubbleWidthClass([{ type: 'text', text: 'Hi' }])).toBe('max-w-[92%]');
    expect(
      assistantBubbleWidthClass([
        {
          type: 'chart',
          title: 'Occupancy',
          kind: 'bar',
          series: [{ name: 'occ', points: [{ x: 'Oct', y: 80 }] }],
          tableAlt: { columns: ['x'], rows: [] },
        },
      ])
    ).toBe('w-full max-w-[100%]');
    expect(
      assistantBubbleWidthClass([
        {
          type: 'calendar',
          title: 'October',
          month: '2026-10',
          days: [{ date: '2026-10-01', state: 'available' }],
          legend: [],
        },
      ])
    ).toBe('w-full max-w-[100%]');
  });
});

describe('patchDynamicFormStatus', () => {
  it('patchDynamicFormStatus is exported', () => {
    expect(typeof patchDynamicFormStatus).toBe('function');
  });
});

describe('patchActionConfirmationStatus', () => {
  it('patchActionConfirmationStatus is exported', () => {
    expect(typeof patchActionConfirmationStatus).toBe('function');
  });
});
