# kh-start-work

Start work on a ticket: **update `develop`**, create a **feature branch**, and load the issue. For new teammates.

## When to use

| User says                            | Action                                    |
| ------------------------------------ | ----------------------------------------- |
| Start work on #N / pick up ticket #N | Branch from latest `develop` + view issue |
| New branch for this bug              | Same (ask for issue # if unknown)         |

## Steps (agent)

1. Confirm issue number. If missing, ask or run **/kh-create-new-ticket** first.

2. Load the issue:

```bash
bun scripts/dev/gh-issue.mjs view --github N
```

Summarize title + acceptance criteria in plain language.

3. Ensure a clean tree (`git status -sb`). If dirty, ask before continuing.

4. Update `develop` and branch:

```bash
git fetch origin
git checkout develop
git pull --ff-only origin develop
git checkout -b <type>/<short-slug>
```

Branch naming:

| Type         | Example                          |
| ------------ | -------------------------------- |
| Bugfix       | `fix/bookings-date-filter`       |
| Feature      | `feat/org-dashboard-empty-state` |
| Docs / chore | `chore/route-guide-inbox`        |

Keep the slug short (3–5 words). Optional: include issue number `fix/123-bookings-filter`.

5. Tell the user:
   - Branch name
   - Issue URL
   - Suggested next step: read `docs/guides/routes/…` if the ticket names a route
   - How they will finish: **/kh-submit-for-review** when ready

## Don'ts

- Do not branch from `main` for multi-tenant work.
- Do not commit unless asked.
- Do not start large refactors outside the ticket scope.

This command is available in chat as **/kh-start-work**
