---
name: competitive-ux-research
description: >-
  Researches how Airbnb (guest) and leading vacation-rental PMS apps (Guesty,
  Hostaway, Lodgify, Hospitable, OwnerRez) handle UI and user flows before
  material UX work. Use for new routes/flows, auth, checkout, payments,
  messaging, settings, onboarding, or redesigns. Skip polish, spacing, renames,
  bugfixes that restore documented behavior, and already-specced wiring.
---

# Competitive UX Research

Study how category leaders solve the **same job** before writing UI or flow code. Adapt patterns to Kame Homes constraints — do not clone competitor chrome.

## Skip this skill when

- Pure backend / edge / DB
- Bugfix restoring documented behavior
- Verbatim copy tweaks
- Visual polish (spacing, colors, typography, control height/density)
- Renames / refactors with no interaction change
- Implementing an already-written plan or route-guide spec without changing the flow

## Workflow (follow in order)

### 1. Frame the task

Answer in one line each:

| Question         | Your answer                                                      |
| ---------------- | ---------------------------------------------------------------- |
| **Job**          | What is the user trying to accomplish?                           |
| **Role**         | Guest (explore/book) · Host (acquire/sign-in) · Operator (admin) |
| **Surface**      | Marketing · operational guest · property/org admin               |
| **Commit point** | When does the user cross an irreversible or costly action?       |

### 2. Pick benchmarks

| Role               | Primary reference        | Secondary                      |
| ------------------ | ------------------------ | ------------------------------ |
| Guest / booking    | **Airbnb**               | Vrbo, Booking.com              |
| Host acquisition   | Airbnb **Host** landing  | Lodgify marketing              |
| Property ops / PMS | **Guesty**, **Hostaway** | Lodgify, Hospitable, OwnerRez  |
| Messaging          | Airbnb Messages          | Guesty Inbox, Hospitable Inbox |
| Payments / payouts | Airbnb checkout          | Guesty / Hostaway finance      |

See [reference.md](reference.md) for feature → app mapping.

### 3. Research (use WebSearch)

Run **at least two** targeted searches, e.g.:

- `Airbnb [feature] flow UX 2024 2025`
- `Guesty OR Hostaway [feature] how it works`

Capture:

- **Entry** — where the user starts (nav, deep link, email)
- **Steps** — linear wizard vs single page vs modal
- **Auth gate** — anonymous until when? (Airbnb: often at confirm/pay)
- **Mobile** — full-screen sheet vs modal vs dedicated page
- **Empty / error / loading** — one line each
- **What they omit** — no signup split, no phone-only, etc.

If the user attached a screenshot, treat it as the target pattern and confirm with search.

### 4. Write the Competitive UX brief

```markdown
## Competitive UX brief — [feature name]

**Job:** …
**Role:** guest | host | operator

### Airbnb (guest)

- Flow: …
- Auth: …
- Mobile: …
- Notable: …

### PMS (host/admin) — [app name]

- Flow: …
- Parallels / differences: …

### Adopt for Kame Homes

- … (specific UI/flow decisions)

### Adapt / skip

- … (Philippines context, minimal copy, existing stack, no new deps)

### Open questions

- … (only if blocked; otherwise decide and note assumption)
```

Keep the brief **≤ 25 lines** unless the user asked for deep research.

### 5. Implement

- Apply **`frontend-design`**, **`mobile-responsive.mdc`**, **`minimal-ui-copy`**
- Guest auth: **modal at checkout** — no explore-mode auth pages (see `auth.md` route guide)
- Host: **`/for-hosts`** + Google OAuth pages only
- Update **`docs/guides/routes/`** when behavior is new or changed

## Kame Homes defaults (from shipped patterns)

| Pattern        | Our choice                                                      |
| -------------- | --------------------------------------------------------------- |
| Guest browse   | Anonymous until Proceed / Submit                                |
| Guest auth     | Unified email OTP + Google/Facebook modal                       |
| Explore → host | Nav **Become a host?** → `/for-hosts` (no floating mode toggle) |
| Admin density  | Dense tables OK; guest forms stay spacious on mobile            |
| Copy           | Minimal — competitors’ helper paragraphs are not automatic      |

## Examples

**Checkout auth (shipped):** Airbnb shows login modal on Confirm and pay, not on search. We gate calendar **Proceed** and form **Submit** with `GuestAuthModal` — email OTP, no `/for-guests/login`.

**Become a host:** Airbnb separates guest and host marketing; we use nav CTA instead of a persistent Explore/Host toggle on marketing pages.

## Anti-patterns

- Implementing from memory without search for unfamiliar flows
- Copying competitor marketing copy or legal blocks into UI
- Adding auth pages on explore mode because a PMS has a login page
- Skipping research because “it’s a small button change” that alters flow

## Additional resources

- Benchmark matrix: [reference.md](reference.md)
