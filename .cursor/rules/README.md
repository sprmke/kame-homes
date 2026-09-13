# Cursor rules & skills — Guest Form Management

Agent context for **Vite + React + Supabase Edge Functions**. Adapted from [property-management-app](https://github.com/...) (PMA); Next.js / tRPC / Drizzle rules are **not** used here.

## Always-on rules (core — loaded every session)

Keep this list **small**. Heavy domain specs use globs.

| File                            | Purpose                                                                  |
| ------------------------------- | ------------------------------------------------------------------------ |
| `project-context.mdc`           | Lean stack + doc index + where-to-edit pointers                          |
| `ai-usage.mdc`                  | Session hygiene, model routing, subagent discipline                      |
| `documentation-maintenance.mdc` | Sync docs with code                                                      |
| `ui-minimal-copy.mdc`           | No extra UI prose                                                        |
| `human-copy.mdc`                | Production-grade copy; no AI tells / em dashes                           |
| `superpowers-opt-in.mdc`        | Superpowers opt-in only (see `/superpowers-*`)                           |
| `git-commits.mdc`               | No Cursor author/co-author in commits                                    |
| `no-prod-deploy.mdc`            | Block prod Supabase/DB deploys (unlock: **kamewave**)                    |
| `markitdown-mcp.mdc`            | Convert PDF/Office attachments via MarkItDown MCP                        |
| `route-guides.mdc`              | Page behavior docs must stay in sync                                     |
| `plans-and-permissions.mdc`     | New features must decide Plans + Team RBAC (or N/A)                      |
| `audit-logging.mdc`             | Mutating changes must emit an `activity_log` event (or N/A)              |
| `mobile-native-ui.mdc`          | Always-on gate: native mobile look/feel for any UI change in `ui/src/**` |
| `ponytail.mdc`                  | Lazy senior dev mode — minimal diffs, reuse first                        |

## New developer setup (AI tooling)

After `git clone` and `bun install`, run **`bun run setup:ai-tooling`** once — symlinks, ecosystem skills (Taste / Playwright CLI / Impeccable), DESIGN.md catalog, OpenCode command links, Claude local settings template, and sync verification. Rules/commands/agents/hooks load from the repo automatically; no copy from `~/.cursor`, `~/.claude`, or `~/.config/opencode` is required.

| Step | Action                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | **`bun run setup:ai-tooling`** — one-shot project AI tooling setup (re-run after broken symlinks)                                                    |
| 1    | Open the repo root in **Cursor**, **Claude Code**, or **OpenCode**                                                                                   |
| 2    | Export **`SUPABASE_ACCESS_TOKEN`** and **`SUPABASE_PROJECT_REF`** in your shell (read-only Supabase MCP)                                             |
| 3    | Install **`markitdown-mcp`** on `PATH`: `uv tool install markitdown-mcp`                                                                             |
| 4    | **Claude Code only:** install the **ponytail** plugin once (`/plugin marketplace add DietrichGebert/ponytail`) — team rule is also in `ponytail.mdc` |

Flags: `bun run setup:ai-tooling -- --skip-agents-skills` · `--skip-playwright-cli` · `--skip-design-md` · `--skip-local-settings` · `--help`

**Two skill roots (both valid):**

| Path                        | Owner                               | Use                                                                                                                           |
| --------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `.agent/skills/` (singular) | GFM repo                            | Team domain skills — edit here; symlinked to `.cursor/skills/` and `.claude/skills/` (OpenCode also loads via `skills.paths`) |
| `.agents/skills/` (plural)  | [skills.sh](https://skills.sh/) CLI | Ecosystem installs — locked in `skills-lock.json`; do not move into `.agent/` (Impeccable scripts hard-code `.agents/` paths) |

**Ecosystem packages (project-scoped):**

| Package                                                             | What you get                                                                                       | Setup                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------ |
| [Taste Skill](https://github.com/Leonxlnx/taste-skill)              | `design-taste-frontend`, `redesign-existing-projects`, `stitch-design-taste`, related craft skills | `bun run setup:agents-skills`  |
| [Playwright CLI](https://github.com/microsoft/playwright-cli)       | skill `playwright-cli` + `bun x playwright-cli` (`@playwright/cli`)                                | `bun run setup:playwright-cli` |
| [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | root `DESIGN.md` + `.agents/design-md/*` refs + skill `design-md`                                  | `bun run setup:design-md`      |

**Intentionally user-scoped (do not commit):** `~/.claude/settings.json` (model, status line, extra plugins), `~/.config/opencode/opencode.json` (OpenCode providers/models), Cursor built-in `~/.cursor/skills-cursor/*`, marketplace plugins (Notion, Figma, Vercel) unless a task needs them.

**Do not install claude-mem** — use repo docs for session context. If present from an old setup: **`bun run cleanup:claude-mem`** (removes global Cursor MCP/hooks + disables Claude plugin).

**Personal skill copies in `~/.claude/skills/`** (design, brand, ui-styling, …) are superseded by this repo's `.agent/skills/` — do not edit the home-directory copies when working here.

Run **`bun run check:ai-tooling-sync`** after changing hooks, commands, agents, or skill symlinks (also runs in pre-commit).

**OpenCode:** project config is root **`opencode.json`** + **`.opencode/`** (index: **`.opencode/README.md`**). Same skills/commands/MCP goals as Cursor/Claude; hooks run via `.opencode/plugins/gfm-ai-tooling.ts`.

## Conditional rules (by file glob — loaded when relevant)

| File                          | Globs / topic                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `booking-workflow.mdc`        | Booking status, orchestrator, guest form / bookings UI                               |
| `admin-auth.mdc`              | JWT allow list, org/property auth surfaces                                           |
| `competitive-ux-research.mdc` | Material UX only (skip polish/bugs)                                                  |
| `mobile-responsive.mdc`       | `ui/src/**` — breakpoints, touch targets, admin shell                                |
| `tech-stack.mdc`              | `ui/**`, Vite, Bun, React Router                                                     |
| `architecture.mdc`            | Feature folders, imports, tooling                                                    |
| `naming-conventions.mdc`      | File naming                                                                          |
| `components.mdc`              | `*.tsx` — shadcn, theme, structure                                                   |
| `state-management.mdc`        | `hooks/`, TanStack Query v5                                                          |
| `forms.mdc`                   | `*Form*`, `schemas/` — RHF + Zod                                                     |
| `security.mdc`                | Edge auth, org/property RBAC                                                         |
| `public-ui.mdc`               | Guest form, calendar, sd-form                                                        |
| `supabase-platform.mdc`       | Migrations, env, Storage                                                             |
| `supabase-edge-functions.mdc` | `supabase/functions/**`                                                              |
| `accessibility.mdc`           | WCAG for UI                                                                          |
| `plan-mode.mdc`               | Plan mode — save finished plans to `docs/workflow/planned/`                          |
| `workflow-docs.mdc`           | Workflow lifecycle — in-progress tracking, no silent moves                           |
| `github-issues.mdc`           | GitHub Issues backlog + shipped archive                                              |
| `social-inbox.mdc`            | Meta inbox                                                                           |
| `notifications.mdc`           | In-app Notification Center (bell, realtime toasts)                                   |
| `pwa.mdc`                     | PWA — service worker, offline cache allowlist, Web Push, offline outbox, kill-switch |
| `ai-assistant-parity.mdc`     | New host dashboard writes → assistant tool or documented exclusion (same change)     |
| `self-review.mdc`             | Agent-requestable — deep `/self-review` production-readiness audit (skill-backed)    |

## Skills (`.cursor/skills/` — invoke `/name` or agent decides)

### Platform & data

| Skill                       | Use for                                                               |
| --------------------------- | --------------------------------------------------------------------- |
| `docs-first`                | Read docs before implementing; then write docs back (same change)     |
| `documentation-maintenance` | Same-change docs writes — Claude Code equivalent of always-on rule    |
| `plans-and-permissions`     | New features: Plans entitlements + Team RBAC checklist (or N/A)       |
| `audit-logging`             | Mutating changes emit an `activity_log` event (or mark N/A)           |
| `supabase-stack`            | Postgres, Storage, edge platform                                      |
| `fix-migration-issues`      | Local `db:migrate` when schema drifts — never default to reset/deploy |
| `supabase-auth`             | OAuth, JWT, RBAC                                                      |
| `tanstack-query`            | Admin hooks, cache, mutations                                         |
| `multi-tenancy`             | Org/property scoping                                                  |

### Product domains

| Skill                             | Use for                                            |
| --------------------------------- | -------------------------------------------------- |
| `booking-workflow`                | Status transitions, orchestrator                   |
| `admin-dashboard`                 | Bookings list / detail                             |
| `property-dashboard-qa`           | Deep QA all property dashboard modules + plan/RBAC |
| `bookings-table`                  | Bookings table UI                                  |
| `gmail-listener`                  | Gmail approvals                                    |
| `social-inbox` / `meta-messaging` | Guest Inbox                                        |
| `notifications`                   | In-app Notification Center                         |
| `integrations`                    | Google, Telegram, Meta, Resend                     |
| `emails`                          | HTML templates + Resend                            |
| `forms`                           | Guest + admin forms                                |

### UI & quality

| Skill                         | Use for                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `competitive-ux-research`     | Material UX only — Airbnb + PMS before new flows                                                 |
| `frontend-design`             | Layout, visual patterns                                                                          |
| `design-md`                   | Root `DESIGN.md` + awesome-design-md inspiration catalog                                         |
| `design-taste-frontend`       | Taste Skill anti-slop craft (`.agents/skills/` — also redesign / stitch variants)                |
| `playwright-cli`              | Token-efficient browser automation via `bun x playwright-cli` (prefer over MCP for coding loops) |
| `component-generator`         | New components                                                                                   |
| `tanstack-table`              | Admin list tables                                                                                |
| `accessibility`               | WCAG deep patterns                                                                               |
| `minimal-ui-copy`             | Sparse copy                                                                                      |
| `human-copy`                  | Production-grade strings; no AI tells / em dashes (pairs with always-on `human-copy.mdc`)        |
| `route-guides`                | `docs/guides/routes/*`                                                                           |
| `performance`                 | Vite bundle, query tuning                                                                        |
| `batch-commit`                | Daily N commits × 5–10 files (not whole tree)                                                    |
| `self-review`                 | Deep production-readiness module review (`/self-review`) — gaps, edge cases, ship verdict        |
| `github-issues`               | GitHub Issues — view, create, ship                                                               |
| `workflow`                    | Workflow docs lifecycle — start/done, in-progress tracking                                       |
| `workflow-intake-scratchpads` | Sync `_to-prompt.md` / `_to-plan.md` emojis with planned/in-progress/done/wont-do                |
| `superpowers`                 | Superpowers opt-in — save plans/specs to `docs/workflow/`                                        |
| `mobile-responsive`           | Breakpoints, touch targets — same content as the glob rule; invoke on Claude Code for UI tasks   |

**No dedicated skill yet** (fall back to `docs-first` + `docs/PROJECT.md` directly): Finance module, Maintenance module, Marketing Studio (AI captions/video/Meta publish), Guest Inbox AI suggestions, guest portal (authenticated guest profile/trips), pricing calendars, super-admin platform ops (`/admin/*`, developments, hosts), org verification (base/enhanced tiers). These are real, shipped parts of the app — don't assume they don't exist just because there's no skill card for them yet.

## Commands (`.cursor/commands/` — also mirrored in Claude / OpenCode)

**Teammate / QA set** (start with `/kh-help`):

| Command                 | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `/kh-help`              | Cheat sheet for all `/kh-*` commands             |
| `/kh-create-new-ticket` | File issue or sub-issue (standard body template) |
| `/kh-start-work`        | Branch from `develop` for issue #N               |
| `/kh-pull-new-changes`  | Pull latest `develop` safely                     |
| `/kh-start-app`         | Run app (default UI → hosted multi-tenant dev)   |
| `/kh-check-before-pr`   | `bun run ci:quality` before review               |
| `/kh-submit-for-review` | Push + open PR **into `develop`**                |

Also: `/self-review`, `/github-issue`, `/fix-merge-conflicts`, `/workflow-*`, `/superpowers-*` — see `.claude/README.md`.

## Subagents (`.cursor/agents/`)

| Agent              | Model   | Use for                       |
| ------------------ | ------- | ----------------------------- |
| `verifier`         | `fast`  | Confirm work complete         |
| `debugger`         | inherit | Failures, errors              |
| `security-auditor` | inherit | Auth, secrets, guest PII      |
| `test-runner`      | `fast`  | `type-check`, `lint`, `build` |

Do **not** spawn Explore / Plan subagents by default — see `ai-usage.mdc`.

## Hooks (`.cursor/hooks.json`)

| Hook                   | Script                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `beforeSubmitPrompt`   | `superpowers-lean-mode.sh` (activates lean mode for any `/superpowers-*` command)                |
| `subagentStart`        | `guard-superpowers-subagents.sh` (denies subagents while lean mode active)                       |
| `stop`                 | `superpowers-lean-cleanup.sh` (clears lean mode marker)                                          |
| `sessionStart`         | `session-superpowers-opt-in.sh`, `session-ai-tooling-sync.sh`, `session-workflow-in-progress.sh` |
| `afterFileEdit`        | `format-edited-file.sh`, `check-stack-terminology.sh`                                            |
| `beforeShellExecution` | `guard-shell.sh` (denies prod Supabase deploy unless **`kamewave`** in command)                  |
| `preToolUse`           | `guard-shipped-migrations.sh` (StrReplace), impeccable hook when installed                       |

Lean mode lib: `scripts/dev/superpowers-lean-lib.sh`. See `.agent/skills/superpowers/SKILL.md` § Lean mode.

## Token budget

- **Always-on** ≈ lean context + hygiene (`project-context`, `ai-usage`, docs/copy/git/deploy guards). Target **well under 15k tokens**.
- **Heavy specs** (`booking-workflow`, `admin-auth`, `mobile-responsive`, competitive UX) = **globs** or skills on demand.
- Per-route detail → `docs/guides/routes/`, not rules.
- **Skipped from PMA:** `thinking-framework` (too heavy), Drizzle, tRPC, Next.js, React Email monorepo, AWS S3, Zustand.
- Avoid `ui-ux-pro-max` unless the user asks for a full design-system pass.

## PMA parity map

| PMA                        | GFM equivalent                                         |
| -------------------------- | ------------------------------------------------------ |
| `01-tech-stack`            | `tech-stack.mdc`                                       |
| `02-architecture`          | `architecture.mdc`                                     |
| `03-database`              | `supabase-platform.mdc` + `supabase-stack` skill       |
| `04-api`                   | `supabase-edge-functions.mdc` + `tanstack-query` skill |
| `05-components`            | `components.mdc`                                       |
| `06-state-management`      | `state-management.mdc`                                 |
| `07-forms`                 | `forms.mdc` + `forms` skill                            |
| `08-security`              | `security.mdc` + `supabase-auth` skill                 |
| `14-public-ui`             | `public-ui.mdc`                                        |
| `15-accessibility`         | `accessibility.mdc` + skill                            |
| `16-docs-sync`             | `documentation-maintenance.mdc`                        |
| `17-supabase-platform`     | `supabase-platform.mdc`                                |
| `property-management`      | `booking-workflow` + `multi-tenancy`                   |
| `drizzle-orm` / `trpc-api` | **N/A**                                                |

## Updating

Add rules with `globs` + update this README. Claude Code has its own equivalent tooling under `.claude/` (index: **`.claude/README.md`**); OpenCode under **`.opencode/README.md`** + root **`opencode.json`**. When you add or change something here, mirror it on the other sides in the same change:

| Cursor                                      | Claude Code                                                | OpenCode                                                                                          | Notes                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.cursor/skills/*`                          | `.claude/skills/*`                                         | `.agent/skills` + `.agents/skills` via `opencode.json` `skills.paths` (+ Claude-compat discovery) | Edit only under `.agent/skills/` (team) or restore ecosystem via `setup:agents-skills`               |
| `.cursor/agents/*.md`                       | `.claude/agents/*.md`                                      | `.opencode/agents/*.md`                                                                           | Translate frontmatter: Cursor `readonly` / Claude `tools` → OpenCode `mode: subagent` + `permission` |
| `.cursor/commands/*.md`                     | `.claude/commands/*.md`                                    | `.opencode/commands/*` → symlink to Claude                                                        | Content is portable as-is                                                                            |
| `.cursor/hooks.json` + `.cursor/hooks/*.sh` | `.claude/settings.json` (`"hooks"`) + `.claude/hooks/*.sh` | `.opencode/plugins/gfm-ai-tooling.ts` (calls `.claude/hooks/`)                                    | Not a straight copy — each harness has a different event shape                                       |
| `.cursor/mcp.json` → `.mcp.json`            | `.mcp.json`                                                | `opencode.json` → `mcp` (local `type` + command array)                                            | Keep MCP server **names** in parity; OpenCode shape differs                                          |

Not everything here has a Claude Code / OpenCode auto-load equivalent (glob-scoped `alwaysApply: false` rules like `security.mdc`, `state-management.mdc`, `tech-stack.mdc` don't auto-load) — `CLAUDE.md` / session context tells agents to read `.cursor/rules/*.mdc` directly when relevant instead of duplicating them.
