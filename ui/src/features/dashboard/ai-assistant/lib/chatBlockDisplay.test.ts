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
  patchActionPlanStatus,
} from '@/features/dashboard/ai-assistant/lib/chatBlockDisplay';
import type { ActionPlanBlock } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

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

describe('patchActionPlanStatus', () => {
  const plan: ActionPlanBlock = {
    type: 'action_plan',
    planId: 'plan-1',
    status: 'proposed',
    steps: [
      {
        stepId: 'step-1',
        stepIndex: 0,
        toolName: 'update_booking_status',
        riskTier: 'tier2_confirmed',
        summary: 'Mark booking as checked in',
        details: [],
        dependsOn: [],
        selected: true,
        status: 'proposed',
      },
      {
        stepId: 'step-2',
        stepIndex: 1,
        toolName: 'send_inbox_reply',
        riskTier: 'tier2_confirmed',
        summary: 'Reply to guest',
        details: [],
        dependsOn: [0],
        selected: true,
        status: 'executed',
      },
    ],
  };

  it('marks the plan and every proposed step denied on cancel, leaving non-proposed steps untouched', () => {
    const [patched] = patchActionPlanStatus([plan], 'plan-1', 'cancelled') as [ActionPlanBlock];
    expect(patched.status).toBe('cancelled');
    expect(patched.steps[0]?.status).toBe('denied');
    expect(patched.steps[1]?.status).toBe('executed');
  });

  it('updates only the plan status (not step status) for a non-cancel status', () => {
    const [patched] = patchActionPlanStatus([plan], 'plan-1', 'running') as [ActionPlanBlock];
    expect(patched.status).toBe('running');
    expect(patched.steps[0]?.status).toBe('proposed');
  });

  it('leaves blocks for a different planId or a different block type unchanged', () => {
    const other: ActionPlanBlock = { ...plan, planId: 'plan-2' };
    const [patchedOther, patchedText] = patchActionPlanStatus(
      [other, { type: 'text', text: 'hi' }],
      'plan-1',
      'cancelled'
    );
    expect(patchedOther).toBe(other);
    expect(patchedText).toEqual({ type: 'text', text: 'hi' });
  });
});
