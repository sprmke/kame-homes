# kh-help

Show the **Kame Homes teammate commands** (`/kh-*`) and when to use each. For new QA / testers / junior devs.

## Reply with this cheat sheet

| Command                   | Use it when you want to…                                       |
| ------------------------- | -------------------------------------------------------------- |
| **/kh-help**              | See this list                                                  |
| **/kh-create-new-ticket** | File a bug/feature ticket or **sub-issue** (uses the template) |
| **/kh-start-work**        | Pick up #N: update `develop`, create a branch                  |
| **/kh-pull-new-changes**  | Get the latest code from `develop`                             |
| **/kh-start-app**         | Run the app (default: UI → `dev.kamehomes.space` backend)      |
| **/kh-check-before-pr**   | Run CI quality checks before review                            |
| **/kh-submit-for-review** | Push your branch and open a **PR into `develop`**              |

## Typical day

1. `/kh-pull-new-changes`
2. `/kh-start-app` → test on the route in the ticket
3. Found a bug? `/kh-create-new-ticket`
4. Fixing it? `/kh-start-work` → implement → `/kh-check-before-pr` → `/kh-submit-for-review`

## Important defaults

- Day-to-day branch: **`develop`** (multi-tenant). Avoid **`main`** unless someone asks for legacy prod work.
- Tickets live on GitHub: **`sprmke/kame-homes`**.
- Route behavior docs: `docs/guides/routes/README.md`.
- Never put passwords or API keys in tickets or chat.

## Other existing commands (advanced)

| Command                        | Purpose                                             |
| ------------------------------ | --------------------------------------------------- |
| `/github-issue`                | Full issue CLI (view / update / **ship**)           |
| `/self-review`                 | Deep production-readiness review of a module        |
| `/production-readiness-review` | Code review for checklist phases 5–10 before Tier 2 |
| `/fix-merge-conflicts`         | Help resolve git merge conflicts                    |
| `/fix-migration-issues`        | Apply **local** DB migrations only                  |

Power-user workflow/docs commands (`/workflow-*`, `/superpowers-*`) are optional — ask a teammate before using them.

This command is available in chat as **/kh-help**
