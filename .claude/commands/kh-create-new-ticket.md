# kh-create-new-ticket

Create a **GitHub issue** (or **sub-issue**) on **`sprmke/kame-homes`** with a short, consistent template. Aimed at new teammates (QA / tester / junior dev).

Repo CLI: `bun scripts/dev/gh-issue.mjs` · skill: `.agent/skills/github-issues/SKILL.md`

## When to use

| User says                                 | Action                                      |
| ----------------------------------------- | ------------------------------------------- |
| New bug / ticket / issue                  | Create a top-level issue (or under an epic) |
| Sub-issue / child of #N / under ticket #N | Create with `--parent N`                    |
| Missing details                           | Ask only what is needed, then create        |

## Steps (agent)

1. **Collect** (ask if missing — keep questions short):
   - Title (short, specific)
   - Type: `bug` | `feature` | `improvement` | `chore`
   - Parent issue number (optional — for sub-issues)
   - Route/page where it happens
   - Environment: `local` | `dev` (`dev.kamehomes.space`) | other
   - For bugs: steps, expected, actual
   - For features: acceptance criteria (1–5 bullets)
2. Fill the **Ticket body template** below (omit unused sections; do not leave `<!-- -->` comments in the filed body).
3. Show the user the **title + body** and wait for a quick OK unless they said “just create it”.
4. Create:

```bash
# Standalone or under an epic/parent:
bun scripts/dev/gh-issue.mjs create \
  --title "Short clear title" \
  --type bug \
  --priority p2 \
  --body "$(cat <<'EOF'
…filled template…
EOF
)"

# Sub-issue under parent #123:
bun scripts/dev/gh-issue.mjs create \
  --title "Short clear title" \
  --type bug \
  --priority p2 \
  --parent 123 \
  --body "$(cat <<'EOF'
…filled template…
EOF
)"
```

Optional: `--section N` only when filing numbered backlog children under an epic section (adds `[N.M]` prefix). Skip for everyday QA bugs.

5. Reply with the **issue URL** and number. Remind: do not put passwords or secrets in tickets.

## Ticket body template

Use this shape for **every** ticket and sub-ticket:

```markdown
## Summary

One or two sentences: what is wrong, or what to build.

## Type

bug | feature | improvement | chore

## Where

- **Route / page:** `/path` or page name (e.g. `/org/:orgSlug/property/:propertySlug/bookings`)
- **Area:** guest | org admin | property admin | parking | super-admin | other
- **Guide (if known):** `docs/guides/routes/…`

## Environment

- **App:** local | https://dev.kamehomes.space | other
- **Browser / device:** e.g. Chrome desktop, Safari iPhone
- **Account / role:** e.g. org owner, property member (no passwords)

## Steps to reproduce

1.
2.
3.

## Expected

What should happen.

## Actual

What happens instead (include error text if any).

## Acceptance criteria

- [ ] …
- [ ] …

## Notes

Screenshots, links, related issues. Optional.
```

### Fill rules

- **Bugs:** Summary, Type, Where, Environment, Steps, Expected, Actual required. Acceptance criteria optional.
- **Features / improvements:** Summary, Type, Where, Acceptance criteria required. Steps/Expected/Actual optional.
- **Sub-issues:** Same template; parent is set via `--parent`, not only in the body. You may add `**Parent:** #N` under Notes.
- Keep it **short**. Prefer concrete routes over vague “dashboard is broken”.
- Route index: `docs/guides/routes/README.md`.

## Priority defaults

| Situation                       | `--priority` |
| ------------------------------- | ------------ |
| App unusable / data loss / auth | `p0` or `p1` |
| Normal bug or small feature     | `p2`         |
| Nice-to-have / polish           | `p3` or `p4` |

## Don'ts

- Do not file secrets, tokens, or full guest PII.
- Do not invent Spec/Epic footers or local `docs/todos/` mirrors.
- Do not attribute the issue to Cursor/AI in the body.
- Prefer this command over ad-hoc `gh issue create` so labels stay consistent.

This command is available in chat as **/kh-create-new-ticket**
