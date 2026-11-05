---
name: agent-reporting
description: Use when writing any end-of-task summary, progress update, investigation answer, or clarifying question. Defines the one report format every agent and model must use in this repo (Cursor and Claude Code; OpenCode is exempt).
---

# Agent reporting format

One report shape for every agent and every model. A reader should get the outcome from the first line and be able to skim the rest in under 30 seconds.

The format is reverse-engineered from the OpenCode sessions on this repo, which the team already considers the bar. **Do not change OpenCode** (`opencode.json`, `AGENTS.md`, `.opencode/**`) to adopt this file. Cursor loads `.cursor/rules/agent-reporting.mdc`; Claude Code loads the `CLAUDE.md` § Reporting format section plus a SessionStart hook.

## 1. The skeleton

```
<one-line outcome>

## <Section>
<tight bullets, table, or 1-2 sentences>

## Verification
<gates actually run, with results>

<one closing question or single next action>
```

| Element     | Rule                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| First line  | Plain sentence, **no heading**, states what happened. Include the PR/URL here when there is one. |
| Sections    | `##` only, **max 5**, titles of 1 to 3 words                                                     |
| Subsections | `###` only when a section has 3+ real groups                                                     |
| Bullets     | One line each, start with the subject, **one nesting level max**                                 |
| Closing     | Exactly one question or one next action. Nothing else.                                           |

Length: under ~150 words for a small change, under ~400 for a module. If it is longer, you are explaining your process instead of the result.

## 2. Report types

Pick one shape. Do not mix them.

| Type                         | Sections (in order)                                         |
| ---------------------------- | ----------------------------------------------------------- |
| **Implementation**           | What changed · Verification · Docs · Notes                  |
| **Investigation / question** | Short answer · What is happening · Options · Recommendation |
| **Deploy / ship**            | Shipped · Verification · Cleanup                            |
| **Blocked / partial**        | What works · What is blocked · Next step                    |
| **Mid-task progress**        | No sections. One or two lines, then keep working.           |

Drop any section with nothing real in it. An empty `## Docs` is worse than no `## Docs`.

## 3. Emphasis is the color

Terminal and chat renderers colorize markdown, so emphasis is how status reads at a glance. Use it for meaning, never for decoration.

| Marker       | Reserved for                                                                 |
| ------------ | ---------------------------------------------------------------------------- |
| `**bold**`   | The outcome word, a status, a count, a PR link, the one risky detail         |
| `` `code` `` | File paths, commands, identifiers, enum values, statuses, env vars, branches |
| Table        | Before/after, gate/result, field/availability, option/status                 |
| Blank line   | Between every section and list. Never wall-of-text.                          |

Bold at most one thing per bullet. If everything is bold, nothing is.

## 4. Fixed status vocabulary

Same words regardless of model, so reports are diffable across sessions.

`pass` · `fail` · `skipped` · `not run` · `blocked` · `N/A — <why>`

```markdown
## Verification

| Gate                 | Result                        |
| -------------------- | ----------------------------- |
| `bun run ci:quality` | pass                          |
| `bun run test`       | pass, 5186 passed / 6 skipped |
| `bun run test:edge`  | not run                       |
```

A short bullet list is fine for 3 or fewer gates. Never claim a gate you did not run, and never write a result you did not read.

## 5. Always say what you did not do

The most useful part of the OpenCode reports. Put it in `## Notes` or the closing line:

- Uncommitted or intentionally unstaged files, and why.
- Work that needs **`kamewave`** (remote migration, prod deploy). Never offer it as a casual next step.
- Tests or gates skipped, and why.
- Pre-existing failures you did not cause.
- `Plans/RBAC: N/A — <why>` · `activity-log: N/A — <why>` when those gates do not apply.

## 6. Asking questions

| Rule      | Detail                                                               |
| --------- | -------------------------------------------------------------------- |
| Count     | **One** decision per message. Not a questionnaire.                   |
| Position  | Last thing in the message.                                           |
| Form      | One bold line, then the options as a flat list, one line each.       |
| Order     | Recommended option first, suffixed `(recommended)`.                  |
| Never ask | Anything the repo, the code, or the docs already answer. Go read it. |

```markdown
**Merge #294 into `develop` now, or wait for your review?**

- Merge now and delete the branch (recommended)
- Leave it open for review
```

In Cursor, prefer the `AskQuestion` tool over writing the list by hand. Claude Code writes it inline.

## 7. Banned

| Never                                                                  | Instead                            |
| ---------------------------------------------------------------------- | ---------------------------------- |
| Opening heading, `## Summary`, `## Overview`, `## Conclusion`          | Start with the outcome sentence    |
| Preamble: "I've completed", "Great! I have now", restating the request | The outcome                        |
| Em dash `—` and en dash `–` as clause breaks                           | Period, comma, colon, parentheses  |
| Decorative emoji, ✅ / ❌ as status                                    | The words in §4                    |
| Numbered mega-outlines (`1.1`, `2.3.1`)                                | `##` sections                      |
| "Let me know if you need anything else", "Feel free to…"               | One concrete question, or nothing  |
| Narrating tool calls ("Now I'll read the file…") in the final report   | What the result was                |
| Re-listing every file you touched when the sections already say it     | A grouped `## What changed`        |
| Self-criticism, apologies, tallying your own mistakes                  | Fix it and state the current truth |
| Claiming done when a gate failed                                       | `## Blocked` with the failing gate |

## 8. Reference examples

Real shapes from the OpenCode sessions. Match the density, not the wording.

**Implementation**

```markdown
Implemented the Public Pages refinement.

## What changed

**New grouping** (`CustomPagesPage.tsx`)

- **Share links**: Calendar, Form, Find parking. No booking needed.
- **Booking links**: Messages, SD Refund, Guest Review. Need dates or an eligible stay.

**Shared logic**

- `guestShareLinkEligibility.ts` is now the single source for refund and review eligibility.

## Verification

- `bun run type-check` pass
- `bun run test` pass, 5186 passed / 6 skipped
- Playwright visual check at 1440px and 375px

## Docs

Updated `docs/guides/routes/org/property/public-pages.md` and `docs/guides/support/faqs.md`. Plans/RBAC: N/A (read-only link copying). Audit logging: N/A (no mutation).

I left the tree uncommitted because the branch already has unrelated work in progress.
```

**Investigation**

```markdown
## Short answer

Dates: **yes, both calendars update automatically.** Bookings: **no, not today.** The code that turns a reservation into a booking row is shipped but dormant, because `create_bookings` is never turned on in the UI or API.

## What is happening today

| Surface                 | Updates? | How                                        |
| ----------------------- | -------- | ------------------------------------------ |
| Guest form date pickers | **Yes**  | `get-booked-dates` returns imported blocks |
| Bookings list           | **No**   | No row is created                          |

## Recommendation

Expose the toggle first. Without it nothing else in the flow is possible.

Want this as a plan under `docs/workflow/planned/` with the API and UI touch points?
```

**Deploy**

```markdown
Deployed to production.

## Shipped

- **PR #292** `feat/skeleton-loader-static-first` to `develop`, merged
- **PR #293** `develop` to `main`, merged. Release commit `794b586be`.

## Verification

- CD Supabase run `42009693250` **success**: migration applied, functions deployed, backup uploaded, smoke passed
- Vercel production **success**; `/`, `/for-hosts`, `/properties`, `/support` all return `200`

## Cleanup

Deleted the merged branch and removed its worktree. Left `feat/weekly-ops-report` in place since it is still checked out.
```

**Mid-task progress**

```markdown
Two findings before I patch:

- Hosted Auth has **no SMTP** and `rate_limit_email_sent = 2` per hour.
- Hosted `mailer_otp_length` is **8**, but every OTP input is hard-coded to 6 digits.

Backing up the current config, then applying.
```

## 9. Before you send a report

- [ ] First line answers "what happened" with no preamble
- [ ] 5 sections or fewer, each with real content
- [ ] One report type, not a blend
- [ ] `## Verification` lists only gates you actually ran, with §4 words
- [ ] Uncommitted work, skipped gates, and `kamewave` items are stated
- [ ] No em dash, no decorative emoji, no `## Summary`
- [ ] Ends with one question or one next action

## Related

- Rule: **`.cursor/rules/agent-reporting.mdc`** (always-on in Cursor)
- Claude Code: **`CLAUDE.md`** § Reporting format, plus `session-agent-reporting.sh`
- Copy voice: **`human-copy`** · Volume: **`minimal-ui-copy`**
- Behavior: **`karpathy-guidelines`** · Finishing work: **`branch-lifecycle`**
