# github-issue

Work the **GitHub backlog** on **sprmke/kame-homes** — view, create, ship issues. Read **`.cursor/skills/github-issues/SKILL.md`** completely.

## User intent → action

| User says                     | Do                                                             |
| ----------------------------- | -------------------------------------------------------------- |
| Pick up / work on issue #N    | `gh-issue.mjs view --github N` → implement → `ship --github N` |
| Create / file / open an issue | `gh-issue.mjs create --section … --title … --parent {epic#}`   |
| Update acceptance criteria    | `gh-issue.mjs update --github N --body …` (GitHub only)        |
| Done / shipped / close        | `gh-issue.mjs ship --github N --notes "…"`                     |

Default repo: **`-R sprmke/kame-homes`**.

**QA / new teammates:** prefer **/kh-create-new-ticket** for filing (includes body template + sub-issues). See **/kh-help** for the full `/kh-*` set.

This command is available in chat with **/github-issue**
