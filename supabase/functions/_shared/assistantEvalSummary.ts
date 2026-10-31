/**
 * Per-module scoring for the assistant golden eval (ai-chat-mode.md Phase 6). The runner
 * (`tests/evals/runLiveEvals.ts --suite assistant`) groups cases by the router module of their
 * expected tool; `--record` stores the summary in `ai_assistant_eval_runs` for super-admin AI usage.
 */

import { ASSISTANT_TOOL_MODULES } from './dashboardAssistantToolRouter.ts';

export type AssistantEvalCase = {
  pass: boolean;
  /** Explicit module from the dataset row; otherwise derived from the expected tools. */
  module?: string;
  expectToolsAny?: string[];
  toolsSent?: number;
};

export type AssistantEvalModuleScore = { module: string; passed: number; total: number };

export type AssistantEvalRun = {
  id: string;
  createdAt: string;
  routed: boolean;
  passed: number;
  total: number;
  avgToolsSent: number | null;
  promptVersion: string | null;
  modules: AssistantEvalModuleScore[];
  failedCaseIds: string[];
};

/** The module a case exercises: the row's `module`, else its first expected tool's module. */
export function evalCaseModule(testCase: Pick<AssistantEvalCase, 'module' | 'expectToolsAny'>) {
  if (testCase.module) return testCase.module;
  for (const tool of testCase.expectToolsAny ?? []) {
    const module = ASSISTANT_TOOL_MODULES[tool];
    if (module) return module;
  }
  return 'safety';
}

/** Pass counts per module, weakest first so regressions surface at the top. */
export function summarizeEvalByModule(cases: AssistantEvalCase[]): AssistantEvalModuleScore[] {
  const byModule = new Map<string, AssistantEvalModuleScore>();
  for (const testCase of cases) {
    const module = evalCaseModule(testCase);
    const score = byModule.get(module) ?? { module, passed: 0, total: 0 };
    score.total += 1;
    if (testCase.pass) score.passed += 1;
    byModule.set(module, score);
  }
  return [...byModule.values()].sort(
    (a, b) => a.passed / a.total - b.passed / b.total || a.module.localeCompare(b.module)
  );
}

export function averageToolsSent(cases: AssistantEvalCase[]): number | null {
  const counts = cases.map((c) => c.toolsSent).filter((n): n is number => typeof n === 'number');
  if (counts.length === 0) return null;
  return Math.round((counts.reduce((sum, n) => sum + n, 0) / counts.length) * 10) / 10;
}

type EvalRunRow = {
  id: string;
  created_at: string;
  routed: boolean;
  passed: number;
  total: number;
  avg_tools_sent: number | string | null;
  prompt_version: string | null;
  modules: unknown;
  failed_case_ids?: string[] | null;
};

export function mapEvalRunRow(row: EvalRunRow): AssistantEvalRun {
  const modules = Array.isArray(row.modules)
    ? (row.modules as AssistantEvalModuleScore[]).filter(
        (m) => typeof m?.module === 'string' && Number.isFinite(m.passed) && m.total > 0
      )
    : [];
  return {
    id: row.id,
    createdAt: row.created_at,
    routed: row.routed,
    passed: row.passed,
    total: row.total,
    avgToolsSent: row.avg_tools_sent == null ? null : Number(row.avg_tools_sent),
    promptVersion: row.prompt_version,
    modules,
    failedCaseIds: row.failed_case_ids ?? [],
  };
}
