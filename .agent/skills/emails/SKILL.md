---
name: emails
description: Resend transactional email from Edge Functions — HTML templates, placeholders, workflow sends. Use when adding or changing booking emails, template editor, or emailService.
---

# Emails (GFM)

## Stack

- **Provider:** Resend (`RESEND_API_KEY` edge secret)
- **Templates:** HTML in `supabase/functions/_shared/email-templates/`
- **Render:** `_shared/renderEmailHtml.ts`, `_shared/brandedEmailShell.ts`, `_shared/emailService.ts` / `propertyTemplateEmail.ts`
- **Orchestration:** `_shared/workflowOrchestrator.ts` on status transitions

No React Email package — plain HTML + placeholder replacement.

## Adding a template

1. Prefer **body HTML** + **`renderBrandedEmailShell`** (`_shared/brandedEmailShell.ts`) for new standalone transactional mail — same shell as property template sends (`fragments/configurable-template-send.html`).
2. Or create a full-document file under `supabase/functions/_shared/email-templates/` only when matching legacy workflow HTML.
3. Add fragments if reusing header/footer from `fragments/`
4. Register sender in `emailService.ts` / dedicated `*Email.ts` module
5. Add **`static_files`** entries in `supabase/config.toml` for every function that loads the template (see `supabase-edge-functions.mdc`)
6. Preview locally: `bun run preview:emails` (full-document workflow templates); body-only templates preview via send path / shell wrap

## Workflow emails

Side-effect matrix: `.cursor/rules/booking-workflow.mdc` §3.

Examples: `booking-acknowledgement.html`, `ready-for-checkin.html`, `new-booking-request.html` (owner notify on guest submit only).

## Placeholders

Property template editor: `_shared/propertyTemplatePlaceholders.ts`, UI catalog in `templatePlaceholderCatalog.ts`.

## Don'ts

- CC guest on Azure-only request emails (GAF/pet to ops)
- Ship new HTML without `static_files` — production `ENOENT`
- Hardcode Monaco branding in new multi-tenant templates without property context

## Docs

- `docs/archive/reference/booking-flow-guide-for-admin.md`
- `docs/archive/operations/production-deployment.md` (Resend + static_files)
