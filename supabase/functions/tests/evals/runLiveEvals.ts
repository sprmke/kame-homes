/**
 * Live AI evals — runs the golden datasets in ./datasets against the real models through the AI
 * gateway, with the production prompt builders. Billing has no org, so nothing is metered or
 * written to the database; it does spend provider tokens (small). Never run in CI.
 *
 *   bun run eval:ai                          # all suites
 *   bun run eval:ai -- --suite inbox         # one suite: inbox | import | assistant | documents
 *   bun run eval:ai -- --threshold 0.9       # override the default pass-rate gate
 *
 * Reads GEMINI_API_KEY(S) / GROQ_API_KEY from the environment or supabase/.env.local.
 * Writes a JSON report to tmp/ai-evals/ (gitignored) and exits 1 when a suite misses its gate.
 * Compare runs by prompt version (each prompt module's PromptRef) to attribute regressions.
 */

import './evalEnv.ts'; // must stay first: populates env before shared services load

import { generateText } from '../../_shared/ai/llmClient.ts';
import { generateWithTools } from '../../_shared/ai/llmTools.ts';
import {
  DASHBOARD_ASSISTANT_PROMPT,
  SYSTEM_PROMPT_PREFIX,
} from '../../_shared/ai/prompts/dashboardAssistant.ts';
import { buildInboxReplyPrompt, INBOX_REPLY_PROMPT } from '../../_shared/ai/prompts/inboxReply.ts';
import { TOOL_DECLARATIONS } from '../../_shared/dashboardAssistantTools.ts';
import { mapColumnsWithModel } from '../../_shared/importColumnMappingAi.ts';
import { assertSafeGuestReply } from '../../_shared/inboxAiSafetyGuard.ts';
import {
  validateReceiptFile,
  validateValidIdFile,
} from '../../_shared/receiptValidationService.ts';
import { readJsonl } from './evalDatasets.ts';

type CaseResult = { id: string; pass: boolean; latencyMs: number; note?: string };
type SuiteResult = { suite: string; gate: number; cases: CaseResult[] };

const DEFAULT_GATES: Record<string, number> = {
  inbox: 0.85,
  import: 0.9,
  assistant: 0.8,
  documents: 0.75,
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = Date.now();
  const value = await fn();
  return { value, latencyMs: Date.now() - started };
}

async function runCase(id: string, fn: () => Promise<{ pass: boolean; note?: string }>) {
  try {
    const { value, latencyMs } = await timed(fn);
    return { id, latencyMs, ...value };
  } catch (err) {
    return { id, pass: false, latencyMs: 0, note: `error: ${(err as Error).message}` };
  }
}

const includesAny = (text: string, needles: string[] = []) =>
  needles.length === 0 || needles.some((n) => text.toLowerCase().includes(n.toLowerCase()));

async function inboxSuite(): Promise<CaseResult[]> {
  type Row = {
    id: string;
    guestMessage: string;
    participantName: string;
    factsText: string;
    pricingValues: number[];
    allowedAccountNumbers: string[];
    otherGuestNames?: string[];
    expect: { guardSafe?: boolean; mustIncludeAny?: string[]; mustNotIncludeAny?: string[] };
  };
  const rows = await readJsonl<Row>('inbox_reply.jsonl');
  const out: CaseResult[] = [];
  for (const row of rows) {
    out.push(
      await runCase(row.id, async () => {
        const { system, user } = buildInboxReplyPrompt({
          orgName: 'Kame Test Stays',
          factsText: row.factsText,
          platform: 'web',
          conversationType: 'dm',
          participantName: row.participantName,
          messages: [
            { direction: 'inbound', body: row.guestMessage, sentAt: new Date().toISOString() },
          ],
        });
        const reply = await generateText({
          feature: 'inbox_suggest',
          prompt: INBOX_REPLY_PROMPT,
          system,
          user,
          temperature: 0.5,
          billing: { organizationId: null },
        });
        const guard = assertSafeGuestReply({
          draftText: reply.text,
          guestMessage: row.guestMessage,
          allowedFacts: {
            pricingValues: row.pricingValues,
            allowedAccountNumbers: row.allowedAccountNumbers,
            factsText: row.factsText,
          },
          participantName: row.participantName,
          otherGuestNames: row.otherGuestNames ?? [],
        });
        const guardOk = row.expect.guardSafe === undefined || guard.safe === row.expect.guardSafe;
        const includeOk = includesAny(reply.text, row.expect.mustIncludeAny);
        const excludeOk = !(row.expect.mustNotIncludeAny ?? []).some((n) =>
          reply.text.toLowerCase().includes(n.toLowerCase())
        );
        return {
          pass: guardOk && includeOk && excludeOk,
          note:
            guardOk && includeOk && excludeOk ? undefined : `reply: ${reply.text.slice(0, 160)}`,
        };
      })
    );
  }
  return out;
}

async function importSuite(): Promise<CaseResult[]> {
  type Row = {
    id: string;
    headers: string[];
    expect: Record<string, string[]>;
    expectUnmatched?: string[];
  };
  const rows = await readJsonl<Row>('import_columns.jsonl');
  const out: CaseResult[] = [];
  for (const row of rows) {
    out.push(
      await runCase(row.id, async () => {
        const { mappings } = await mapColumnsWithModel(
          { headers: row.headers, samplesByHeader: {} },
          { organizationId: null }
        );
        const byHeader = new Map(mappings.map((m) => [m.rawHeader, m.suggestedTarget]));
        const misses = Object.entries(row.expect).filter(
          ([header, allowed]) => !allowed.includes(byHeader.get(header) ?? '')
        );
        const leaked = (row.expectUnmatched ?? []).filter((h) => byHeader.get(h));
        return {
          pass: misses.length === 0 && leaked.length === 0,
          note:
            misses.length || leaked.length
              ? `misses: ${misses.map(([h]) => `${h}→${byHeader.get(h)}`).join(', ')} leaked: ${leaked.join(', ')}`
              : undefined,
        };
      })
    );
  }
  return out;
}

async function assistantSuite(): Promise<CaseResult[]> {
  type Row = { id: string; message: string; expectToolsAny?: string[]; forbidTools?: string[] };
  const rows = await readJsonl<Row>('assistant_tool_selection.jsonl');
  const out: CaseResult[] = [];
  for (const row of rows) {
    out.push(
      await runCase(row.id, async () => {
        const result = await generateWithTools({
          feature: 'dashboard_assistant',
          prompt: DASHBOARD_ASSISTANT_PROMPT,
          system: `${SYSTEM_PROMPT_PREFIX}\n\nKnown facts:\nOrganization: Kame Test Stays. One property: Azure North 1204.`,
          user: row.message,
          tools: TOOL_DECLARATIONS,
          toolMode: 'auto',
          maxOutputTokens: 512,
          billing: { organizationId: null },
        });
        const called = result.toolCalls.map((c) => c.name);
        const expectOk =
          !row.expectToolsAny || called.some((name) => row.expectToolsAny!.includes(name));
        const forbidOk = !called.some((name) => (row.forbidTools ?? []).includes(name));
        return {
          pass: expectOk && forbidOk,
          note: expectOk && forbidOk ? undefined : `called: ${called.join(', ') || '(none)'}`,
        };
      })
    );
  }
  return out;
}

async function documentsSuite(): Promise<CaseResult[]> {
  const dir = new URL('./fixtures/ocr/', import.meta.url);
  const expected = JSON.parse(await Deno.readTextFile(new URL('expected.json', dir))) as Record<
    string,
    { kind: 'receipt' | 'valid_id'; verdict: string[]; amount?: number; date?: string }
  >;
  const out: CaseResult[] = [];
  for (const [file, gold] of Object.entries(expected)) {
    out.push(
      await runCase(file, async () => {
        const bytes = await Deno.readFile(new URL(file, dir));
        const doc = new File([bytes], file, { type: 'image/png' });
        const result =
          gold.kind === 'valid_id'
            ? await validateValidIdFile(doc, null)
            : await validateReceiptFile(doc, null);
        const verdictOk = gold.verdict.includes(result.verdict);
        const amountOk = gold.amount === undefined || result.extracted_amount === gold.amount;
        const dateOk = gold.date === undefined || result.extracted_date === gold.date;
        return {
          pass: verdictOk && amountOk && dateOk,
          note:
            verdictOk && amountOk && dateOk
              ? undefined
              : `verdict ${result.verdict}, amount ${result.extracted_amount}, date ${result.extracted_date}`,
        };
      })
    );
  }
  return out;
}

const SUITES: Record<string, () => Promise<CaseResult[]>> = {
  inbox: inboxSuite,
  import: importSuite,
  assistant: assistantSuite,
  documents: documentsSuite,
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const args = Deno.args;
const onlySuite = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : null;
const thresholdOverride = args.includes('--threshold')
  ? Number(args[args.indexOf('--threshold') + 1])
  : null;

const results: SuiteResult[] = [];
for (const [suite, run] of Object.entries(SUITES)) {
  if (onlySuite && suite !== onlySuite) continue;
  const cases = await run();
  results.push({ suite, gate: thresholdOverride ?? DEFAULT_GATES[suite], cases });
}

let failedGate = false;
console.log('\nAI eval results');
for (const r of results) {
  const passed = r.cases.filter((c) => c.pass).length;
  const rate = r.cases.length ? passed / r.cases.length : 0;
  const latencies = r.cases.map((c) => c.latencyMs).filter((ms) => ms > 0);
  const ok = rate >= r.gate;
  if (!ok) failedGate = true;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${r.suite.padEnd(10)} ${passed}/${r.cases.length} ` +
      `(${Math.round(rate * 100)}%, gate ${Math.round(r.gate * 100)}%)  ` +
      `p50 ${percentile(latencies, 0.5)}ms  p95 ${percentile(latencies, 0.95)}ms`
  );
  for (const c of r.cases.filter((c) => !c.pass)) console.log(`        ✗ ${c.id}: ${c.note ?? ''}`);
}

const reportDir = new URL('../../../../tmp/ai-evals/', import.meta.url);
await Deno.mkdir(reportDir, { recursive: true });
const reportPath = new URL(
  `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  reportDir
);
await Deno.writeTextFile(
  reportPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)
);
console.log(`\nReport: ${reportPath.pathname}`);
Deno.exit(failedGate ? 1 : 0);
