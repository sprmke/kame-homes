# Claude Code skills

**Canonical source:** `.agent/skills/<name>/SKILL.md`. `.cursor/skills/<name>` and `.claude/skills/<name>` are **relative symlinks** into `.agent/skills/<name>` (e.g. `.claude/skills/forms -> ../../.agent/skills/forms`) — edit only under `.agent/skills/`; both tool-side paths update automatically. OpenCode loads the same trees via `opencode.json` `skills.paths` and Claude-compatible discovery under `.claude/skills/`.

**Ecosystem skills** (Taste Skill, playwright-cli, Impeccable) live under `.agents/skills/` (plural) via [skills.sh](https://skills.sh/) and `skills-lock.json`. Symlinks in `.cursor/skills/` and `.claude/skills/` point at those folders — restore with `bun run setup:agents-skills`. OpenCode discovers `.agents/skills/` natively as well.

One exception: **`verify/`** in this folder is a real directory, Claude Code–only (no Cursor equivalent, no `.agent/skills` counterpart — it's the recorded recipe for Claude Code's bundled `/verify` skill). Don't turn it into a symlink. OpenCode can still load it via `.claude/skills/verify` when Claude-compat skill discovery is enabled.

## Keeping commands/agents/hooks in sync

Skills sync for free via the shared symlink target. **Commands, agents, and hooks do not** — each harness has its own real files with side-specific frontmatter/shape:

1. Edit the Cursor-side file (`.cursor/commands/*.md`, `.cursor/agents/*.md`, `.cursor/hooks/*.sh` + `.cursor/hooks.json`).
2. Apply the equivalent conceptual change to the Claude-side file (`.claude/commands/*.md`, `.claude/agents/*.md`, `.claude/hooks/*.sh` + `.claude/settings.json`), translating frontmatter/shape as needed:
   - Agents: `readonly: true` → drop `Write`/`Edit`/`NotebookEdit` from `tools`; `model: fast` → `model: haiku`.
   - Commands: content is portable as-is; add a one-line `description` frontmatter if missing.
   - Hooks: **not** a straight copy — Claude Code hooks read `tool_input.file_path` / `tool_input.command` from stdin and return `hookSpecificOutput.permissionDecision`, not Cursor's `file_path`/`command` + `{permission, user_message, agent_message}` shape; also update the registration in `.claude/settings.json`, not `hooks.json`.
3. Apply the equivalent change for **OpenCode**:
   - Commands: ensure `.opencode/commands/<name>.md` exists (setup script symlinks to `.claude/commands/`).
   - Agents: update `.opencode/agents/<name>.md` (OpenCode frontmatter: `mode: subagent`, `permission:` — not Claude's `tools:`).
   - Hooks: keep `.claude/hooks/` scripts correct — `.opencode/plugins/gfm-ai-tooling.ts` invokes them. See **`.opencode/README.md`**.
   - MCP: when editing root `.mcp.json`, also update `opencode.json` `mcp` (local `type` + command array; `{env:VAR}` interpolation).
4. Run `bun run check:ai-tooling-sync` (also runs in pre-commit) to catch drift — symlink parity, command/agent existence parity, hook-name parity, `.cursor/mcp.json` symlink validity, OpenCode config + MCP name parity. Known, intentional gaps are allow-listed in `scripts/dev/ai-tooling-sync-exceptions.txt`.
5. Commit all sides together in the same change.

## MCP servers

**Global** MCP config is intentionally asymmetric: Cursor reads `~/.cursor/mcp.json` (user-level), Claude Code uses its own plugin/marketplace mechanism, OpenCode personal providers live in `~/.config/opencode/opencode.json` — there's no shared global file and none is needed. **Per-repo** parity: `.mcp.json` (Cursor + Claude) and `opencode.json` `mcp` (OpenCode shape).

Index: **`.cursor/rules/README.md`** (Cursor) · **`.claude/README.md`** (Claude Code) · **`.opencode/README.md`** (OpenCode)
