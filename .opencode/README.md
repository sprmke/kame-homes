# OpenCode tooling — Guest Form Management

Project-scoped AI tooling for **[OpenCode](https://opencode.ai)** so sessions match the Cursor / Claude Code / `.agent` workflow.

## Setup

```bash
bun install
bun run setup:ai-tooling   # skills + MCP symlink + OpenCode command links + verify
```

Then open the repo in OpenCode (`opencode` from the repo root).

Personal providers/models live in `~/.config/opencode/opencode.json` — not committed.

## What maps where

| Concern          | Canonical source                                                                    | OpenCode path                                           |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Project rules    | `CLAUDE.md` + always-on `.cursor/rules/*.mdc` (incl. **`karpathy-guidelines.mdc`**) | Auto `CLAUDE.md` + `opencode.json` → `instructions`     |
| Agent behavior   | skill **`karpathy-guidelines`**                                                     | `.agent/skills/karpathy-guidelines/` via `skills.paths` |
| Team skills      | `.agent/skills/`                                                                    | `skills.paths` + Claude-compat `.claude/skills/`        |
| Ecosystem skills | `.agents/skills/` (`skills-lock.json`)                                              | `skills.paths` + auto `.agents/skills`                  |
| Commands         | `.claude/commands/`                                                                 | `.opencode/commands/*` → symlinks                       |
| Subagents        | conceptual parity with `.cursor` / `.claude` agents                                 | `.opencode/agents/*.md`                                 |
| Hooks            | shared scripts in `.claude/hooks/`                                                  | `.opencode/plugins/gfm-ai-tooling.ts`                   |
| MCP              | root `.mcp.json`                                                                    | `opencode.json` → `mcp` (OpenCode local-server shape)   |

Do **not** create `AGENTS.md` unless you intend it to replace `CLAUDE.md` (OpenCode uses the first of `AGENTS.md` / `CLAUDE.md`).

## Commands

Same slash commands as Cursor / Claude Code (wired via symlinks):

`/kh-help`, `/kh-create-new-ticket`, `/kh-start-work`, `/kh-pull-new-changes`, `/kh-start-app`, `/kh-check-before-pr`, `/kh-submit-for-review`, `/self-review`, `/github-issue`, `/fix-merge-conflicts`, `/fix-migration-issues` (via skill), `/workflow-start`, `/workflow-done`, `/workflow-wont-do`, `/workflow-sync-scratchpads`, `/superpowers-*`

## Subagents

| Agent              | Mode     | Notes                                      |
| ------------------ | -------- | ------------------------------------------ |
| `debugger`         | subagent | Full tools for root-cause fixes            |
| `security-auditor` | subagent | `edit: deny`                               |
| `test-runner`      | subagent | `edit: deny` — type-check / lint / build   |
| `verifier`         | subagent | `edit: deny` — skeptical completion checks |

## Hooks (plugin)

`.opencode/plugins/gfm-ai-tooling.ts` reinjects the same session + tool guards:

- Superpowers opt-in context, AI tooling sync status, workflow in-progress list
- Shell: prod Supabase deploy blocked unless **`kamewave`** (via `.claude/hooks/guard-shell.sh` + `prod-deploy-guard-lib.sh`)
- Edit: no modifying existing files under `supabase/migrations/`
- After edit: Prettier format + wrong-stack (Next.js / tRPC / Drizzle) warning

Config-level denials in `opencode.json` also block `supabase/migrations/**` edits and `rm -rf /` / `~`.

## MCP

Mirrors project `.mcp.json`: `supabase` (read-only), `playwright`, `context7`, `markitdown`.

Export `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` in your shell. Install `markitdown-mcp` on `PATH`.

## Parity checks

```bash
bun run check:ai-tooling-sync   # also pre-commit
opencode debug skill            # list discovered skills
opencode debug agent debugger   # agent frontmatter
opencode debug config           # merged config
```

## Updating

| Change         | What to edit                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Skills         | `.agent/skills/<name>/` only (`bun run setup:ai-tooling` keeps links)                                   |
| Commands       | `.claude/commands/` and `.cursor/commands/` together; OpenCode reuses Claude via symlink                |
| Agents         | `.cursor/agents/`, `.claude/agents/`, and `.opencode/agents/` (OpenCode frontmatter differs)            |
| Hooks behavior | Shared scripts under `.claude/hooks/` (+ Cursor mirrors); OpenCode plugin calls the Claude-side scripts |
| MCP servers    | Update `.mcp.json` **and** `opencode.json` `mcp` block in the same change                               |

Index: **`.cursor/rules/README.md`** · **`.claude/README.md`** · this file.
