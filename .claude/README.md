# Claude Code tooling — Guest Form Management

Agent context for **Claude Code** in this repo. Mirrors `.cursor/rules/README.md` (the Cursor-side index) and `.opencode/README.md` (OpenCode). `.mdc` rule files aren't auto-loaded by Claude Code, so `CLAUDE.md` points here and at `.cursor/rules/*.mdc` directly.

## New developer setup

```bash
bun install
bun run setup:ai-tooling
```

See **`.cursor/rules/README.md` → New developer setup (AI tooling)** for MCP env vars, `markitdown-mcp`, OpenCode, and ponytail plugin (manual once per machine).

| Item                          | Location                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------- |
| One-shot setup                | `bun run setup:ai-tooling`                                                       |
| Team hooks + MCP enable list  | `.claude/settings.json` (committed)                                              |
| Personal permission overrides | `.claude/settings.local.json` (gitignored — created by setup script)             |
| Shared skills                 | `.agent/skills/<name>/` via symlinks in `.claude/skills/`                        |
| Ecosystem skills              | `.agents/skills/` — Taste Skill, playwright-cli, Impeccable (`skills-lock.json`) |
| DESIGN.md                     | Root `DESIGN.md` + `.agents/design-md/` + skill `design-md`                      |
| Claude-only verify skill      | `.claude/skills/verify/` (real directory, not symlinked)                         |
| OpenCode (same goals)         | `opencode.json` + `.opencode/` — see **`.opencode/README.md`**                   |
| Drift check                   | `bun run check:ai-tooling-sync`                                                  |

Install the **ponytail** marketplace once per machine if you want the plugin commands; the same guidance is always-on in `.cursor/rules/ponytail.mdc`.

## Always loaded

| File        | Purpose                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| `CLAUDE.md` | Stack, commands, architecture, booking workflow, doc-sync rules — repo root |

**Plan mode:** `.cursor/rules/plan-mode.mdc` — finished plans go to `docs/workflow/planned/` (also summarized in `CLAUDE.md` § Plan mode).

## Skills (`.claude/skills/*/SKILL.md` — invoke `/name` or Claude decides)

Symlinked from `.agent/skills/` (canonical source — see `.claude/skills/README.md`) plus one Claude Code–only addition:

| Skill                       | Use for                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify`                    | **Claude Code only.** Recorded recipe for the bundled `/verify` skill — type-check/lint/build, curl edge functions locally, drive the UI with Playwright MCP. No Cursor equivalent.                                                                                                                                                 |
| `documentation-maintenance` | **Same-change docs writes.** Mirrors always-on Cursor rule `documentation-maintenance.mdc` (Claude cannot auto-load `.mdc`). Invoke before claiming any material change done. Also injected via SessionStart + PostToolUse hooks.                                                                                                   |
| `mobile-responsive`         | **Mandatory for any UI change in `ui/src/**`.** Native mobile look/feel: bottom sheets, bottom nav, density, touch targets. Always-on gate: `mobile-native-ui.mdc`; full spec: `mobile-responsive.mdc`. Invoke before implementing or reviewing UI.                                                                                 |
| `route-guides`              | Per-route operator guides in `docs/guides/routes/*.md` — mirrors an **always-on** Cursor rule (`route-guides.mdc`) that has no automatic Claude Code equivalent, so invoke it for **every** route/page/section change, no exceptions. Also summarized in `CLAUDE.md` § Docs are the source of truth.                                |
| `plans-and-permissions`     | New host features must decide **Plans** entitlements and **Team** RBAC (or mark N/A) in the same change — mirrors always-on Cursor rule `plans-and-permissions.mdc`. Invoke before claiming any new capability done.                                                                                                                |
| `audit-logging`             | New or changed mutating capability (edge write, workflow transition, cron, webhook, direct-write surface, guest/public action) must emit an `activity_log` event via `_shared/activityLog.ts` (or mark `activity-log: N/A — <why>`) — mirrors always-on Cursor rule `audit-logging.mdc`. Invoke before claiming mutating work done. |
| `human-copy`                | Short, plain, production-grade user-facing strings with no AI tells (especially no em dash). Mirrors always-on Cursor rule `human-copy.mdc`. Invoke on any UI/email/notification/plan copy change.                                                                                                                                  |
| `minimal-ui-copy`           | Prefer **no** extra UI prose; pairs with `human-copy` when text is required. Mirrors always-on `ui-minimal-copy.mdc`.                                                                                                                                                                                                               |

All other skills (booking-workflow, admin-dashboard, forms, multi-tenancy, gmail-listener, supabase-stack, tanstack-query, accessibility, github-issues, …) are the same `SKILL.md` on both tools via the `.agent/skills/` symlink — see `.agent/skills/<name>/SKILL.md` for what each covers.

**No dedicated skill yet** for: Finance module, Maintenance module, Marketing Studio (AI captions/video/Meta publish), Guest Inbox AI-suggested replies, the guest portal (authenticated guest profile/trips, separate from the anonymous booking form), pricing calendars, super-admin platform ops (`/admin/*` — developments, hosts, cross-org property listing), org verification (base/enhanced tiers). These are real, shipped parts of the app, not hypothetical — read `docs/PROJECT.md` directly for them until a skill exists.

**If `property-management-app` shows up as an additional working directory in this session**, you may see Next.js/tRPC/Drizzle/AWS-S3-flavored skills in the picker (`drizzle-orm`, `trpc-api`, `aws-s3`, `form-builder`, `property-management`, `testing`, `ui-design`, …). Those belong to that _other_ repo and are correct there — never use them while working in `guest-form-management`, regardless of what the picker offers. See `CLAUDE.md` → Don'ts.

## Subagents (`.claude/agents/*.md`)

Ported from `.cursor/agents/`. Claude Code subagents use `tools:` (allowlist) instead of Cursor's `readonly:` flag, and `model: haiku` instead of Cursor's `model: fast`.

| Agent              | model   | tools                              | Use for                                                           |
| ------------------ | ------- | ---------------------------------- | ----------------------------------------------------------------- |
| `debugger`         | inherit | all                                | Root-cause errors and test failures                               |
| `security-auditor` | inherit | Read, Grep, Glob, Bash (no writes) | Readonly audit of auth/PII/edge-function surfaces before shipping |
| `test-runner`      | haiku   | Bash, Read, Grep, Glob             | Run type-check/lint/build after a change                          |
| `verifier`         | haiku   | Bash, Read, Grep, Glob             | Skeptically confirm claimed-done work actually works              |

## Commands (`.claude/commands/*.md`)

Same as Cursor's `.cursor/commands/`; Claude Code commands and skills both create `/name` — these stay as plain commands since they're short, fixed prompts, not multi-file skill packages.

| Command                 | Purpose                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `/kh-help`              | Teammate cheat sheet for all `/kh-*` commands (QA / junior-friendly)                                        |
| `/kh-create-new-ticket` | Create GitHub issue or sub-issue with the standard ticket template                                          |
| `/kh-start-work`        | Update `develop`, branch for issue #N, load ticket                                                          |
| `/kh-pull-new-changes`  | Safely pull latest `develop`                                                                                |
| `/kh-start-app`         | Run the app (default: UI → hosted multi-tenant dev)                                                         |
| `/kh-check-before-pr`   | Run `bun run ci:quality` before review                                                                      |
| `/kh-submit-for-review` | Push branch + open PR **into `develop`**                                                                    |
| `/fix-merge-conflicts`  | Resolve merge conflicts without breaking either side's changes                                              |
| `/fix-migration-issues` | Apply pending **local** migrations (`bun run db:migrate`) — no reset/deploy by default                      |
| `/github-issue`         | View / create / update / ship issues on `sprmke/kame-homes` (backed by `scripts/dev/gh-issue.mjs`)          |
| `/self-review`          | Deep production-readiness review of a module/change (skill: `self-review`) — gaps, edge cases, ship verdict |

## Display (`~/.claude/settings.json` — user scope, not committed)

Personal Claude Code UI settings live in **`~/.claude/settings.json`**, not in this repo. Current defaults:

| Setting                      | Value                     | What it shows                                                                                        |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `statusLine`                 | `~/.claude/statusline.sh` | 2-line bar: model, effort, git branch, context %, in/out tokens, session cost, duration, rate limits |
| `showTurnDuration`           | `true`                    | Per-turn timing (e.g. "Cooked for 1m 6s") after responses                                            |
| `showThinkingSummaries`      | `true`                    | Extended-thinking summaries in **terminal CLI only** (not VS Code extension)                         |
| `effortLevel`                | `high`                    | Reasoning effort; change mid-session with `/effort`                                                  |
| `model`                      | `sonnet`                  | Default model; switch with `/model`                                                                  |
| `terminalProgressBarEnabled` | `true`                    | Progress bar in supported terminals (iTerm2, Ghostty, ConEmu)                                        |

**Quick checks:** `/status` (loaded settings + model), `/cost` (token/cost breakdown), `/config` (interactive settings UI). Reload the VS Code extension after changing `model` or `outputStyle`.

To regenerate the status line script: `/statusline show model, effort, context bar, tokens, cost, git branch, and rate limits`.

## Hooks (`.claude/settings.json` → `"hooks"`, scripts in `.claude/hooks/`)

Ported from `.cursor/hooks.json` + `.cursor/hooks/*.sh`, translated to Claude Code's stdin JSON shape (`tool_input.file_path` / `tool_input.command`) and output contract (`hookSpecificOutput.permissionDecision`). See `.claude/skills/README.md` for the exact translation notes if re-syncing after a Cursor-side hook change.

| Hook                             | Event / matcher                                         | Purpose                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format-edited-file.sh`          | PostToolUse, Edit\|Write                                | Prettier-format the file that was just touched                                                                                                                                                                                     |
| `check-stack-terminology.sh`     | PostToolUse, Edit\|Write                                | Warns (non-blocking) on Next.js/tRPC/Drizzle terms — wrong stack for this repo                                                                                                                                                     |
| `remind-docs-on-code-edit.sh`    | PostToolUse, Edit\|Write                                | After `ui/` / edge / migration edits, reminds agent to update matching docs in the same change (non-blocking)                                                                                                                      |
| `session-docs-sync-reminder.sh`  | SessionStart                                            | Injects mandatory same-change docs sync (Claude cannot auto-load `documentation-maintenance.mdc`)                                                                                                                                  |
| `guard-shell.sh`                 | PreToolUse, Bash                                        | **Deny prod Supabase deploy** (`deploy:supabase`, `db push`, `functions deploy`, remote migrations) unless command contains unlock **`kamewave`**; deny `rm -rf /`/`~`; ask before `DROP TABLE`, `stop:supabase:clean`, force-push |
| `guard-shipped-migrations.sh`    | PreToolUse, Edit                                        | Deny editing an existing file under `supabase/migrations/` — add a new migration instead                                                                                                                                           |
| `superpowers-lean-mode.sh`       | beforeSubmitPrompt (Cursor) / UserPromptSubmit (Claude) | Activate lean mode for any `/superpowers-*` command; inject mode-specific constraints (Claude)                                                                                                                                     |
| `guard-superpowers-subagents.sh` | subagentStart (Cursor) / PreToolUse Task (Claude)       | Deny Task/subagents while lean mode marker is active                                                                                                                                                                               |
| `superpowers-lean-cleanup.sh`    | stop (Cursor) / Stop (Claude)                           | Clear lean mode marker when agent completes                                                                                                                                                                                        |

## MCP servers (`.mcp.json`, shared with Cursor via `.cursor/mcp.json` symlink)

**Project-required (stdio only — Claude Code–compatible):**

| Server       | Needs                                                         | Use for                                         |
| ------------ | ------------------------------------------------------------- | ----------------------------------------------- |
| `supabase`   | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (env)         | Schema/logs/advisors — **read-only by default** |
| `playwright` | nothing                                                       | Long exploratory browser loops for `/verify`    |
| `context7`   | nothing (optional key for higher rate limits)                 | Current library docs                            |
| `markitdown` | `markitdown-mcp` on `PATH` (`uv tool install markitdown-mcp`) | PDF/Office → markdown (`markitdown-mcp.mdc`)    |

Prefer skill **`playwright-cli`** + `bun x playwright-cli` for day-to-day coding-agent browser checks (token-efficient). Keep Playwright MCP for persistent exploratory sessions. Setup: `bun run setup:playwright-cli`.

**Not in project `.mcp.json` (use these instead):**

| Need                    | Prefer                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GitHub                  | `gh` CLI, or Claude/Cursor **GitHub plugin** MCP (not project `.mcp.json` — HTTP shape was invalid for Claude Code) |
| Notion / Figma / Vercel | User/plugin MCP only when that task needs them — keep disabled otherwise                                            |

Export `SUPABASE_*` in your shell profile — never commit them. Ensure `markitdown-mcp` resolves on `PATH` (avoid `${HOME}/…` in `.mcp.json` — Claude Code rejects that).

To allow Supabase MCP to write (default is `--read-only`), edit the `args` in `.mcp.json` locally — don't commit that change unless the whole team should have write access from chat.

## Token / usage playbook

Canonical: **`.cursor/rules/ai-usage.mdc`**. Summary:

| Do                                             | Don't                                             |
| ---------------------------------------------- | ------------------------------------------------- |
| `/clear` between tasks                         | Multi-day sessions / >150k context by default     |
| Composer (Cursor) / Sonnet for implementation  | Opus / high-thinking for polish                   |
| Read `booking-workflow.mdc` only when relevant | Expect the full status-machine dump every turn    |
| One agent + `rg`/`Read`                        | Explore → Plan → brainstorm chains without asking |
| `/superpowers-*` when you want that workflow   | Auto-invoke Superpowers brainstorming             |
| `/effort medium` for chores                    | `effort=high` on every rename                     |

**User-scope Claude plugins (`~/.claude/settings.json`):** keep what you use. **Do not enable `claude-mem@thedotmack`** — use `docs/PROJECT.md` + route guides; run **`bun run cleanup:claude-mem`** if it was installed earlier. Strong candidates to **disable** if unused: `skill-creator`, `claude-code-setup`, `feature-dev`, `vercel` (unless deploying), `obsidian` (unless vault tasks), `code-review` (if you use Bugbot/PR review elsewhere). Keep **`superpowers`** only if you still run `/superpowers-*`; otherwise disable the plugin entirely to cut accidental brainstorming spend.

## Updating

- **Skills:** edit `.agent/skills/<name>/SKILL.md` directly — `.cursor/skills/<name>` and `.claude/skills/<name>` are symlinks to it, so both sides update automatically. OpenCode loads the same roots via `opencode.json` `skills.paths` and Claude-compat discovery. Never edit the symlinked paths.
- **Commands, agents, hooks:** each side has its own real file (different frontmatter/shape). Edit the Cursor-side file (`.cursor/commands/`, `.cursor/agents/`, `.cursor/hooks/` + `.cursor/hooks.json`), then apply the equivalent conceptual change to the Claude-side file (`.claude/commands/`, `.claude/agents/`, `.claude/hooks/` + `.claude/settings.json`) **and** OpenCode (`.opencode/commands` symlinks to Claude; `.opencode/agents/` frontmatter; hooks plugin calls Claude scripts) — see `.claude/skills/README.md` and **`.opencode/README.md`**.
- Run `bun run check:ai-tooling-sync` (also enforced in pre-commit) before committing; known intentional gaps live in `scripts/dev/ai-tooling-sync-exceptions.txt`.
- Commit all sides in the same change.
- `.mcp.json` needs no Cursor mirroring — `.cursor/mcp.json` is a symlink to it. **Also update `opencode.json` `mcp`** when adding/removing servers (OpenCode uses a different local-server shape).
