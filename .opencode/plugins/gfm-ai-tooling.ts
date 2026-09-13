/**
 * GFM team AI tooling parity for OpenCode.
 *
 * Reuses the same shell hooks as Claude Code / Cursor:
 *   - session context (superpowers opt-in, AI tooling sync, workflow in-progress)
 *   - prod-deploy + dangerous bash guards (kamewave unlock via shared lib)
 *   - shipped-migration edit block
 *   - prettier format + wrong-stack term warning after edits
 *
 * Hook scripts live under `.claude/hooks/` and share logic with Cursor via
 * `scripts/dev/prod-deploy-guard-lib.sh`.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type PluginInput = {
  directory: string;
  worktree?: string;
  $: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    quiet: () => {
      text: () => Promise<string>;
      nothrow: () => { text: () => Promise<string>; exitCode: Promise<number | null> };
    };
  };
  client?: {
    app?: {
      log?: (args: {
        body: {
          service: string;
          level: 'debug' | 'info' | 'warn' | 'error';
          message: string;
          extra?: Record<string, unknown>;
        };
      }) => Promise<void>;
    };
  };
};

type BeforeOutput = { args: Record<string, unknown> };
type AfterOutput = {
  title: string;
  output: string;
  metadata: Record<string, unknown>;
};

function runHookScript(
  root: string,
  scriptRel: string,
  stdin: string
): { stdout: string; status: number | null } {
  const script = path.join(root, scriptRel);
  if (!fs.existsSync(script)) {
    return { stdout: '{}', status: 1 };
  }
  const result = spawnSync('bash', [script], {
    cwd: root,
    input: stdin,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 2 * 1024 * 1024,
  });
  return {
    stdout: (result.stdout || '').trim() || '{}',
    status: result.status,
  };
}

function parseHookJson(stdout: string): Record<string, unknown> {
  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function permissionFromHook(parsed: Record<string, unknown>): {
  decision?: string;
  reason?: string;
  additionalContext?: string;
} {
  const specific = parsed.hookSpecificOutput as Record<string, unknown> | undefined;
  if (specific) {
    return {
      decision: specific.permissionDecision as string | undefined,
      reason: specific.permissionDecisionReason as string | undefined,
      additionalContext: specific.additionalContext as string | undefined,
    };
  }
  return {
    additionalContext: parsed.additional_context as string | undefined,
  };
}

function resolveFilePath(args: Record<string, unknown>): string {
  const candidates = [args.filePath, args.file_path, args.path, args.file, args.target];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

function resolveCommand(args: Record<string, unknown>): string {
  if (typeof args.command === 'string') return args.command;
  if (typeof args.cmd === 'string') return args.cmd;
  if (Array.isArray(args.command)) return args.command.map(String).join(' ');
  return '';
}

function collectSessionContext(root: string): string {
  const chunks: string[] = [];

  // Superpowers opt-in (same text as .claude/hooks/session-superpowers-opt-in.sh)
  chunks.push(
    [
      'SUPERPOWERS OPT-IN (this repo)',
      '',
      'Superpowers auto-workflows are OFF unless the user runs /superpowers-* or explicitly asks.',
      '',
      'Do NOT auto-invoke superpowers:brainstorming, writing-plans, executing-plans, etc.',
      '',
      'When Superpowers IS allowed:',
      '- Plans → docs/workflow/planned/<slug>.md (no YYYY-MM-DD- prefix)',
      '- Specs → docs/workflow/intake/<slug>-design.md',
      '- Read .agent/skills/superpowers/SKILL.md for path overrides.',
      '',
      'Retired folders (must not exist): docs/superpowers/, docs/planning/, docs/todos/ — GitHub backlog is in docs/README.md.',
    ].join('\n')
  );

  // AI tooling sync (warn-only — same as session-ai-tooling-sync.sh)
  const sync = spawnSync('bash', [path.join(root, 'scripts/dev/check-ai-tooling-sync.sh')], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (sync.status === 0) {
    chunks.push(
      'AI tooling sync: OK (Cursor/Claude/OpenCode skills, commands, agents, hooks, mcp in sync).'
    );
  } else {
    chunks.push(
      "AI tooling sync: DRIFT DETECTED — run 'bun run check:ai-tooling-sync' for details."
    );
  }

  // Workflow in-progress list
  const progressDir = path.join(root, 'docs/workflow/in-progress');
  try {
    const files = fs
      .readdirSync(progressDir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    if (files.length === 0) {
      chunks.push(
        'Workflow in-progress: (none) — use /workflow-start when picking up a planned item.'
      );
    } else {
      chunks.push(
        `Workflow in-progress: ${files.join(', ')} — primary session docs under docs/workflow/in-progress/.`
      );
    }
  } catch {
    chunks.push(
      'Workflow in-progress: (none) — use /workflow-start when picking up a planned item.'
    );
  }

  // Docs sync (Claude/OpenCode cannot auto-load alwaysApply .mdc — mirror session-docs-sync-reminder.sh)
  chunks.push(
    [
      'DOCS SYNC (mandatory): Material code/behavior changes must update matching docs in the SAME change — not later.',
      'Route/page UX → docs/guides/routes/* (route-guides skill).',
      'API/env/architecture → docs/PROJECT.md.',
      'Plans/tiers → docs/architecture/plans-feature-matrix.md + Plans guides.',
      'New host capabilities → decide Plans + Team RBAC (or N/A) via plans-and-permissions skill.',
      'Booking/auth invariants → .cursor/rules/booking-workflow.mdc or admin-auth.mdc.',
      'Invoke documentation-maintenance skill before claiming done.',
      'Canonical: CLAUDE.md § Docs are the source of truth · .cursor/rules/documentation-maintenance.mdc.',
    ].join(' ')
  );

  chunks.push(
    [
      'MOBILE-NATIVE UI (mandatory for ui/src/**): Preserve native app look on phone — bottom sheets',
      '(ResponsiveModal, MobileChoiceSheet, ResponsiveOverflowMenu), bottom nav (BottomTabBar / ContextualActionBar),',
      'no centered Dialog or floating DropdownMenu on max-lg.',
      'Invoke mobile-responsive skill before shipping UI.',
      'Gate: .cursor/rules/mobile-native-ui.mdc · Spec: mobile-responsive.mdc ·',
      'Inventory: docs/workflow/for-testing/mobile-native-redesign.md.',
    ].join(' ')
  );

  chunks.push(
    [
      'OpenCode project tooling (this repo)',
      '',
      '- Rules: CLAUDE.md (auto) + always-on `.cursor/rules/*.mdc` via opencode.json instructions',
      '- Skills: `.agent/skills/` + `.agents/skills/` (+ Claude-compat `.claude/skills/`)',
      '- Commands: `.opencode/commands/` → `.claude/commands/`',
      '- Agents: `.opencode/agents/`',
      '- MCP: opencode.json (mirrors root `.mcp.json`)',
      '- Hooks: this plugin (shared scripts under `.claude/hooks/`)',
      '- Setup: `bun run setup:ai-tooling` · drift: `bun run check:ai-tooling-sync`',
    ].join('\n')
  );

  return chunks.join('\n\n');
}

export default async function GfmAiToolingPlugin(ctx: PluginInput) {
  const root = ctx.directory;
  const sessionContext = collectSessionContext(root);
  let injectedSession = false;

  return {
    'experimental.chat.system.transform': async (_input: unknown, output: { system: string[] }) => {
      if (!injectedSession && sessionContext) {
        output.system.push(sessionContext);
        injectedSession = true;
      }
    },

    'tool.execute.before': async (
      input: { tool: string; sessionID: string; callID: string },
      output: BeforeOutput
    ) => {
      const tool = (input.tool || '').toLowerCase();

      if (tool === 'bash' || tool === 'shell') {
        const command = resolveCommand(output.args);
        if (!command) return;

        const { stdout } = runHookScript(
          root,
          '.claude/hooks/guard-shell.sh',
          JSON.stringify({ tool_input: { command } })
        );
        const { decision, reason } = permissionFromHook(parseHookJson(stdout));
        if (decision === 'deny') {
          throw new Error(
            reason ||
              'Blocked by GFM shell guard (production Supabase deploy requires unlock word kamewave).'
          );
        }
        if (decision === 'ask') {
          // Surface as a hard pause: OpenCode shell already may ask; throw with clear message
          // so the model (and user) must re-confirm. Does not auto-allow dangerous commands.
          throw new Error(
            `${reason || 'This command requires confirmation.'} Re-run only if the user explicitly confirmed.`
          );
        }
        return;
      }

      if (tool === 'edit' || tool === 'write' || tool === 'strreplace' || tool === 'apply_patch') {
        const filePath = resolveFilePath(output.args);
        if (!filePath) return;

        const { stdout } = runHookScript(
          root,
          '.claude/hooks/guard-shipped-migrations.sh',
          JSON.stringify({ tool_input: { file_path: filePath } })
        );
        const { decision, reason } = permissionFromHook(parseHookJson(stdout));
        if (decision === 'deny') {
          throw new Error(
            reason ||
              'Editing shipped migrations under supabase/migrations/ is not allowed — add a new migration file.'
          );
        }
      }
    },

    'tool.execute.after': async (
      input: { tool: string; sessionID: string; callID: string; args: Record<string, unknown> },
      output: AfterOutput
    ) => {
      const tool = (input.tool || '').toLowerCase();
      if (tool !== 'edit' && tool !== 'write' && tool !== 'strreplace' && tool !== 'apply_patch') {
        return;
      }

      const filePath = resolveFilePath(input.args || {});
      if (!filePath) return;

      // Format (non-blocking)
      runHookScript(
        root,
        '.claude/hooks/format-edited-file.sh',
        JSON.stringify({ tool_input: { file_path: filePath } })
      );

      // Wrong-stack warning (non-blocking; surface to agent via output text)
      const stack = runHookScript(
        root,
        '.claude/hooks/check-stack-terminology.sh',
        JSON.stringify({ tool_input: { file_path: filePath } })
      );
      const { additionalContext: stackCtx } = permissionFromHook(parseHookJson(stack.stdout));
      if (stackCtx) {
        output.output = `${output.output || ''}\n\n[${stackCtx}]`;
      }

      // Docs-sync reminder after material code edits (non-blocking)
      const docs = runHookScript(
        root,
        '.claude/hooks/remind-docs-on-code-edit.sh',
        JSON.stringify({ tool_input: { file_path: filePath } })
      );
      const { additionalContext: docsCtx } = permissionFromHook(parseHookJson(docs.stdout));
      if (docsCtx) {
        output.output = `${output.output || ''}\n\n[${docsCtx}]`;
      }

      const mobile = runHookScript(
        root,
        '.claude/hooks/remind-mobile-native-on-ui-edit.sh',
        JSON.stringify({ tool_input: { file_path: filePath } })
      );
      const { additionalContext: mobileCtx } = permissionFromHook(parseHookJson(mobile.stdout));
      if (mobileCtx) {
        output.output = `${output.output || ''}\n\n[${mobileCtx}]`;
      }
    },
  };
}
