---
title: 'Property templates'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-20
---

# Property templates

Route: `/org/:orgSlug/property/:propertySlug/templates`

> **Status:** Documented — admin UI, DB persistence, workflow email sends, and custom template manual send shipped

## Purpose

Each template card shows a **title**, **subtitle** (built-in description from the server registry; custom templates use a generic fallback), Edit/Preview tabs, WYSIWYG editor (white `bg-card` surface on light theme), placeholders, and reset-to-default. On phone, Edit/Preview and Placeholders/Send/Reset/Save (and Delete for custom) are **icon-only** so the whole toolbar stays on one row; labels return from `sm` up.

**Custom templates → Send to guest (shipped):** Custom template cards show a **Send** icon button (next to Placeholders) once the saved content has no unsaved edits. It opens a dialog to search/pick a booking (guest name, date, or status) and sends that exact saved content to the booking's guest email immediately — not tied to booking status or an automation toggle, and no cooldown. Uses the same `renderPropertyTemplateSendEmail` shell as every other template send. Requires `bookings.detail.workflow:edit` (same leaf as the booking-detail manual workflow email resends). Skipped (with a toast) if the guest's email is on the suppression list. Emits `booking.custom_template_sent` to the org activity log on success (`booking` category, `metadata.template_key` / `template_name`).

**Plans/RBAC decision (Send to guest):** No new `PlanFeatureKey` — a custom template only exists on Starter+ (creating one is already gated by `customTemplates`), so the send action inherits that gate transitively; a Free org has no custom template card to send from. No new permission leaf — reuses `bookings.detail.workflow:edit`, the same booking-mutation-adjacent leaf that already gates manual workflow email resends from the booking detail page.

On **phone/tablet**, the page scrolls inside the section layout (`AdminSectionNavLayout` + `AdminMobilePage` flex height chain). Desktop keeps the sticky section sidebar + content scrollport.

Operators edit per-property copy here. **Preview and live sends use the same renderer** (`renderPropertyTemplateSendEmail` + `fragments/configurable-template-send.html`). Dynamic blocks (tables, payment breakdown, CTAs) are **`{{placeholders}}` in the template body** — visible in Preview when sample/send HTML is injected.

Template bodies (and section images) are bulk-copyable via org **Properties → Copy settings**.

**Plan gating (`customTemplates`, Starter+):** Standard templates (house rules, check-in/out, parking reminders) are free — edit, preview, placeholders, reset, and save with no plan gate and no WYSIWYG blur. Email templates stay editable/previewable on Free; **Reset** always restores the shipped default (ungated `action: reset`); **Save** opens the upgrade modal when not entitled (server also gates email-key content PATCH). **Add Custom Template** (page header / mobile hero) and create/save **custom** templates require Starter+ — client pre-flight plus `property-templates-settings` (`action: create`, custom-key PATCH, and email-key PATCH). Delete custom stays open. Email and custom cards show a `TierBadge` (replacing the old Email category pill). The **Email templates** and **Custom templates** section headings also show a `TierBadge` when the org is below Starter.

### Permissions (Phase 5)

Route/nav: `templates:view`. In-page: `templates.standard:edit`, `templates.email:edit`, `templates.custom:{add,edit,delete}`. Members without an edit leaf see preview-only cards (no Save/Reset/Delete). Add Custom is hidden without `templates.custom:add`.

## Host-facing knowledge

Templates is where you customize the text guests and your team receive: stay guide sections (house rules, check-in and check-out, parking) and automated emails (booking confirmations, document requests, ready-for-check-in). Preview shows the same layout that goes out to guests, whether that's on the stay guide or in an email.

**Mobile editor chrome:** Edit/Preview uses the dense card-header segment track (~28px). Placeholders / Reset / Save are compact 32px icon controls (labels from `sm+`). TipTap toolbar buttons match that size. Rich-text body/headings use a phone-scaled type set (14px body; H1 ~20px) so content doesn’t dwarf admin chrome.

**Common host questions**

- Q: Which templates do guests actually see?
  A: The four standard templates (house rules, check-in instructions, check-out instructions, parking reminders) appear on the guest stay guide during their booking window. Email templates are used for automated messages throughout the booking process.
- Q: Where do I upload Stay Guide section photos?
  A: **Public Pages → Stay Guide → Edit → Content**. Templates still edits the text for those sections, but section images upload only in the Stay Guide page editor (with live preview).
- Q: If I mess up an email template, can I undo it?
  A: Yes. Use **Reset to default** on any built-in template to restore the original wording, including dynamic sections like payment tables and signatures. Reset works on Free; saving your own edits still needs Starter.
- Q: Can I customize email templates on Free?
  A: You can open, edit, and reset them. Saving your changes requires Starter. Standard stay-guide templates can be edited and saved on Free.
- Q: Do custom templates get sent automatically?
  A: No, custom templates are never part of the automated booking workflow. Use the **Send** button on a custom template card to send it to a specific booking's guest on demand — the built-in standard and email templates are still the only ones wired to guest-facing pages and automated status-driven sends.
- Q: Why is Add Custom Template asking me to upgrade?
  A: Custom templates and saving email templates are on Starter and above. You can still fully edit and save the four standard stay-guide templates on Free, and you can preview, edit, and reset email copy — Save just prompts you to upgrade.

## Integration status

### Shipped

| Layer                           | Behavior                                                                                                                                                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin UI**                    | Load, edit, save, reset, custom create/delete, Edit/Preview, placeholders insert, image resize                                                                                                                       |
| **Persistence**                 | `property_template_contents` per `property_id` + `template_key`; optional **`section_image_url`** (standard only — uploaded from Stay Guide Page Editor); built-ins fall back to shipped defaults when no row exists |
| **API**                         | `GET/PATCH property-templates-settings`, `POST property-templates-preview`, `POST upload-property-template-asset` (section + inline images)                                                                          |
| **Preview**                     | Standard: client sample placeholders. Email: same send shell + `buildSampleDynamicSections()` as production                                                                                                          |
| **Workflow sends**              | `emailService.ts` → `renderPropertyTemplateSendEmail()` resolves DB/default body, substitutes plain + dynamic section placeholders, wraps in send shell                                                              |
| **Custom template manual send** | `POST send-property-custom-template-email` → `sendPropertyCustomTemplateEmail()` — booking picker dialog, on-demand send, no status/automation gate                                                                  |

### Standard templates → guest stay guide (shipped)

The four **standard** keys (`house-rules`, `check-in-instructions`, `check-out-instructions`, `parking-reminders`) render on the token-gated guest page **`/properties/:slug/stay-guide?token=`** during the booking access window. See **[[stay-guide|Guest stay guide (token-gated brochure)]]**.

**Stay guide preview** — use **Public Pages → Stay Guide → Edit** (live preview) or open the Stay Guide card’s preview URL. Templates edits body copy only; it does not include a **Preview stay guide** button.

### Previously not wired (email/PDF)

| Area                            | Behavior                                                             |
| ------------------------------- | -------------------------------------------------------------------- |
| **Standard templates** (4 keys) | **Not** injected into workflow emails or PDFs (stay guide page only) |

### Email send path

| UI `template_key`               | `emailService` function       | Dynamic section placeholders                                                                                                                                                                                                                    |
| ------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email-gaf-request`             | `sendEmail`                   | `{{urgent_notice}}`, `{{update_notice}}`, `{{email_signature_section}}`                                                                                                                                                                         |
| `email-pet-request`             | `sendPetEmail`                | `{{urgent_notice}}`, `{{update_notice}}`, `{{pet_details_section}}`, `{{pet_attachments_section}}`, `{{email_signature_section}}`                                                                                                               |
| `email-parking-request`         | `sendParkingBroadcast`        | `{{urgent_notice}}`, `{{update_notice}}`, `{{booking_vehicle_copy}}`, `{{parking_reply_callout_section}}`, `{{email_signature_section}}`                                                                                                        |
| `email-new-booking-request`     | `sendNewBookingRequestNotify` | `{{urgent_notice}}`, `{{new_booking_detail_tables}}`, `{{downpayment_receipt_ai_section}}`, `{{booking_link_cta}}`                                                                                                                              |
| `email-booking-acknowledgement` | `sendBookingAcknowledgement`  | `{{booking_acknowledgement_flow_section}}`, `{{email_signature_section}}`                                                                                                                                                                       |
| `email-ready-for-checkin`       | `sendReadyForCheckin`         | `{{ready_for_checkin_booking_summary_section}}`, payment/GCash sections (empty when total balance is 0), `{{document_reminders_section}}`, `{{stay_guide_cta_section}}`, `{{ready_for_checkin_contact_section}}`, `{{email_signature_section}}` |
| `email-sd-refund-form-request`  | `sendSdRefundFormRequest`     | `{{sd_refund_checklist_section}}`, `{{sd_refund_details_section}}`                                                                                                                                                                              |

Static files under `email-templates/*.html` remain for reference; live sends use the configurable body + send shell above.

## Sections

| Group    | Keys                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Standard | `house-rules`, `check-in-instructions`, `check-out-instructions`, `parking-reminders`                                                                                                      |
| Email    | `email-gaf-request`, `email-pet-request`, `email-parking-request`, `email-new-booking-request`, `email-booking-acknowledgement`, `email-ready-for-checkin`, `email-sd-refund-form-request` |
| Custom   | `custom-{uuid}` — operator-created; sent on demand to a picked booking's guest via **Send to guest**                                                                                       |

Built-in defaults ship in `propertyTemplates.ts` on the server. Rows in `property_template_contents` override defaults per property.

**Reset to default** restores shipped body copy including dynamic section placeholders (each on its own paragraph). Existing saved rows from before this layout will not show tables/CTAs until reset or placeholders are added manually.

## Save paths

| Action                                                                                          | API                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Load all                                                                                        | `GET property-templates-settings?property_id=`                                                                                      |
| Save standard content                                                                           | `PATCH property-templates-settings` `{ templateKey, content, sectionImageUrl? }` — free on every tier                               |
| Save email content                                                                              | same PATCH shape — requires **`customTemplates`** (429 + `upgradeHook` when not entitled); Free UI opens upgrade modal on Save      |
| Reset built-in to default                                                                       | `PATCH` `{ action: "reset", templateKey }` — free on every tier (including email); restores shipped default content                 |
| Upload section / inline image                                                                   | `POST upload-property-template-asset` multipart `assetType`, `file`, `templateKey` (section only)                                   |
| Create custom                                                                                   | `PATCH` `{ action: "create", name, content }` — requires plan feature **`customTemplates`** (429 + `upgradeHook` when not entitled) |
| Save custom content                                                                             | `PATCH` `{ templateKey: "custom-…", content, name? }` — same **`customTemplates`** gate as create                                   |
| Delete custom                                                                                   | `PATCH` `{ action: "delete", templateKey }`                                                                                         |
| Preview (email shell)                                                                           | `POST property-templates-preview` `{ templateKey, category, content, name? }`                                                       |
| Auth: `verifyAdminJwt` + property scope via `property_id` query (same as other admin settings). |                                                                                                                                     |

## Preview

- **Standard:** inline HTML preview (`RichTextDisplay`) with sample `{{placeholder}}` substitution (same sample values as the preview API).
- **Email:** iframe from preview edge function — **`renderPropertyTemplatePreview`** calls **`renderPropertyTemplateSendEmail`** with `contentOverride`, sample vars, and **`buildSampleDynamicSections()`** for section placeholders present in the template body (same layout as production sends).

Preview and send are aligned on `fragments/configurable-template-send.html`.

## Placeholders

Each template card has a **Placeholders** button (next to Edit / Preview). Tap a token to copy + insert at the editor cursor (modal closes); use the copy icon to copy only.

### Block-level section placeholders

Full-width dynamic blocks (tables, CTAs, urgent/update callouts, signatures, etc.) must each sit on **their own paragraph** — one `{{token}}` per `<p>` line, never inline with other copy or other section tokens.

| Rule          | Detail                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Insert**    | Placeholders modal + editor insert put block-level tokens on a new paragraph automatically (`PROPERTY_BLOCK_PLACEHOLDER_KEYS` in `templatePlaceholderCatalog.ts`).                            |
| **Defaults**  | Shipped bodies in `propertyTemplates.ts` put `{{urgent_notice}}` and `{{update_notice}}` **above** `Good day,` on GAF, pet, and parking templates (new booking: urgent above intro only).     |
| **Normalize** | `normalizeBlockLevelPlaceholdersInHtml()` splits inline section tokens; `normalizeEmailCalloutPlaceholders()` moves callouts above the salutation and inserts missing tokens on load/preview. |
| **Reset**     | Restores the shipped default layout when operators want a clean starting point.                                                                                                               |

Block-level keys include: `urgent_notice`, `update_notice`, `new_booking_detail_tables`, `downpayment_receipt_ai_section`, `booking_link_cta`, `pet_details_section`, `pet_attachments_section`, `booking_vehicle_copy`, `parking_reply_callout_section`, `booking_acknowledgement_flow_section`, all ready-for-check-in sections, `sd_refund_checklist_section`, `sd_refund_details_section`, and `email_signature_section`.

**`{{urgent_notice}}`** — GAF, pet, parking, and new booking request templates only (empty when check-in is not same-day in Asia/Manila). **`{{update_notice}}`** — GAF, pet, and parking request templates only (empty on first send; amber callout on resubmit). **Preview** shows sample HTML for both when those placeholders are in the saved body.

## WYSIWYG in real email

At send time, `prepareConfigurableEmailBodyHtml()`:

- Adds inline image styles (`max-width:100%`, block display) when missing
- Absolutizes root-relative links (`href="/…"`) using `publicGuestAppOrigin`

Admin-authored HTML is trusted (not stripped). Plain placeholder **values** are HTML-escaped; dynamic section HTML is injected pre-rendered.

## DB

Table **`property_template_contents`**: `property_id`, `template_key`, `category`, `name` (custom only), `content`, `updated_at`.

## Implementation map

| Layer                       | Path                                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page                        | `ui/src/features/dashboard/bookings/pages/TemplatesPage.tsx`                                                                                              |
| Editor card                 | `ui/src/features/dashboard/bookings/components/property-templates/PropertyTemplateEditorCard.tsx`                                                         |
| WYSIWYG                     | `ui/src/features/dashboard/bookings/components/property-templates/RichTextEditor.tsx`                                                                     |
| Hooks                       | `ui/src/features/dashboard/bookings/hooks/usePropertyTemplates.ts`                                                                                        |
| Registry / defaults         | `supabase/functions/_shared/propertyTemplates.ts`                                                                                                         |
| Send render                 | `supabase/functions/_shared/propertyTemplateEmail.ts`                                                                                                     |
| Dynamic sections            | `supabase/functions/_shared/propertyTemplateEmailSections.ts`                                                                                             |
| Block placeholder normalize | `supabase/functions/_shared/normalizeBlockLevelPlaceholders.ts` (+ UI mirror `ui/src/features/dashboard/bookings/lib/normalizeBlockLevelPlaceholders.ts`) |
| Preview render              | `supabase/functions/_shared/propertyTemplatePreview.ts`                                                                                                   |
| Settings API                | `supabase/functions/property-templates-settings/index.ts`                                                                                                 |
| Preview API                 | `supabase/functions/property-templates-preview/index.ts`                                                                                                  |
| **Send path**               | `supabase/functions/_shared/emailService.ts` → `renderPropertyTemplateSendEmail()`                                                                        |
| **Custom send dialog**      | `ui/src/features/dashboard/bookings/components/property-templates/SendCustomTemplateDialog.tsx`                                                           |
| **Custom send hook**        | `ui/src/features/dashboard/bookings/hooks/usePropertyTemplates.ts` → `useSendPropertyCustomTemplateEmail()`                                               |
| **Custom send API**         | `supabase/functions/send-property-custom-template-email/index.ts` → `sendPropertyCustomTemplateEmail()` (`_shared/emailService.ts`)                       |

## Dynamic branding (subjects, From, shell)

Workflow emails resolve labels from the database via **`propertyEmailBranding.ts`**:

| Field                                                           | Source                                                                                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Organization name** (shell `{{brandName}}`, logo alt, footer) | `organizations.name`                                                                                                                                  |
| **Property name** (`{{property_name}}` placeholder)             | `properties.name`                                                                                                                                     |
| **Unit label** (shell subtitle, subjects, From display name)    | Booking/form `tower_and_unit_number` → **`app_settings.gaf_tower_and_unit_number`** → **`properties.tower_and_unit`** → property name                 |
| **From email address**                                          | **`RESEND_FROM_EMAIL`** env, else **`app_settings.email_reply_to`**                                                                                   |
| **From display name**                                           | e.g. `{unit} - GAF Request` or `{unit} - {org}` for guest mail                                                                                        |
| **Logo**                                                        | **`org_settings.email_logo_url`** (via merged app settings)                                                                                           |
| **Brand color**                                                 | Org/property `brandColor` (property override → org settings) — the picker hex, same as admin `--primary` / `bg-primary`. Email CTA labels stay white. |
| **Body copy**                                                   | **`property_template_contents`** (Templates page)                                                                                                     |

Platform defaults (not property-specific): **`DEFAULT_EMAIL_LOGO_URL`** when org has no logo; **`PUBLIC_GUEST_APP_ORIGIN`** for link absolutization; preview sample placeholders still use demo values in the UI catalog.

## Dynamic section data sources (live sends)

Preview uses **`buildSampleDynamicSections()`** with demo dates/names/phones. **Production sends** resolve real values from booking rows + org/property settings (never legacy Kame Home / Monaco 2604 literals).

| Section placeholder                             | Templates                                              | Live data source                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `{{urgent_notice}}`                             | GAF, pet, parking, new booking                         | Same-day check-in vs Asia/Manila today                                                                         |
| `{{update_notice}}`                             | GAF, pet, parking                                      | Resubmit flag + unit label from branding                                                                       |
| `{{email_signature_section}}`                   | GAF, pet, parking, acknowledgement, ready-for-check-in | `app_settings.gaf_unit_owner` + unit label                                                                     |
| `{{pet_details_section}}`                       | Pet request                                            | Guest form / booking pet fields                                                                                |
| `{{pet_attachments_section}}`                   | Pet request                                            | Static attachment list (no property-specific copy)                                                             |
| `{{parking_reply_callout_section}}`             | Parking request                                        | Static ops callout                                                                                             |
| `{{booking_vehicle_copy}}`                      | Parking request                                        | Booking vehicle fields + unit label                                                                            |
| `{{new_booking_detail_tables}}`                 | New booking notify                                     | Booking stay/guest/notable columns                                                                             |
| `{{downpayment_receipt_ai_section}}`            | New booking notify                                     | `dp_receipt_ai_*` on booking (empty when absent)                                                               |
| `{{booking_link_cta}}`                          | New booking notify                                     | Admin booking URL + org brand color                                                                            |
| `{{booking_acknowledgement_flow_section}}`      | Acknowledgement                                        | Unit + booking dates; step 2 includes Facebook + Airbnb “message us on …” links                                |
| `{{ready_for_checkin_booking_summary_section}}` | Ready for check-in                                     | Booking dates/times/pax + unit label                                                                           |
| `{{document_reminders_section}}`                | Ready for check-in                                     | GAF always; parking/pet lines from `need_parking` / `has_pets`                                                 |
| `{{payment_breakdown_section}}`                 | Ready for check-in                                     | Booking pricing columns (empty when total balance is 0)                                                        |
| `{{gcash_payment_section}}`                     | Ready for check-in                                     | All payment methods (account name/number); QR image only when uploaded (empty section when total balance is 0) |
| `{{ready_for_checkin_contact_section}}`         | Ready for check-in                                     | Facebook + Airbnb links; phone + email from property profile → org profile                                     |
| `{{facebook_page_url}}`                         | Acknowledgement, RFCI, SD refund                       | Resolved Facebook URL (`app_settings` → `org_settings`)                                                        |
| `{{airbnb_url}}`                                | Acknowledgement, RFCI, SD refund                       | Resolved Airbnb URL (`app_settings` → `org_settings`)                                                          |
| `{{contact_name}}`                              | Acknowledgement, RFCI, SD refund                       | Property `contactName` → org `contactName`                                                                     |
| `{{contact_phone}}`                             | Acknowledgement, RFCI, SD refund                       | Property `contactPhone` → org `contactPhone`                                                                   |
| `{{contact_email}}`                             | Acknowledgement, RFCI, SD refund                       | Property `contactEmail` → org `contactEmail`                                                                   |
| `{{social_contact_mentions}}`                   | Acknowledgement, RFCI, SD refund                       | “message us on **Facebook** or **Airbnb**” — only platform names linked                                        |
| `{{sd_refund_checklist_section}}`               | SD refund                                              | Unit label (elevator card step)                                                                                |
| `{{sd_refund_details_section}}`                 | SD refund                                              | Security deposit amount, `/sd-form` URL, brand color                                                           |

Plain body placeholders (`{{guest_name}}`, `{{property_name}}`, etc.) are filled by **`buildBookingPlaceholderVars()`** from the booking row + **`loadPropertyEmailBranding()`** + merged app settings.

Implementation: **`guestContactInfo.ts`** (contact resolution), **`propertyTemplateEmailSections.ts`** (section HTML builders), **`emailService.ts`** (send-time injection).

## Edge cases

- Custom templates capped at **20** per property.
- Content max **120 000** characters.
- Reset writes the shipped default back to DB (same as PMA).
- Unknown `{{tokens}}` in saved content are left literal in sent email.
- **Base64 / data-URI images** from the editor may be blocked or inflate message size in some clients — prefer HTTPS image URLs.
- **Existing saved templates** may lack dynamic section placeholders until **Reset to default** or manual insert; inline section tokens are auto-split onto separate lines on load/save/render via `normalizeBlockLevelPlaceholdersInHtml`.
- **SD refund** — default body uses `{{sd_refund_checklist_section}}` and `{{sd_refund_details_section}}` on separate lines. Saved templates with legacy `{{sd_refund_footer_section}}` still render (combined block) until reset or manual swap.
- **Ready for check-in** — payment/GCash placeholders resolve to empty strings when total guest balance is 0.
- **`house-rules`** standard template is not injected into ready-for-check-in (legacy `houseRulesSection` remains disabled for Gmail size).
- Missing `property_id` on a booking falls back to built-in defaults (no DB row).

---

## Testing

| Layer | Path / spec                                                                                                   | Manual                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Unit  | Template placeholder normalization when pure helpers change                                                   | —                                                                                  |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` templates shell (`@ci`)                             | WYSIWYG save, email send; asserts no console "duplicate" TipTap extension warnings |
| E2E   | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` "custom template sends to a picked booking" (`@ci`) | Send to guest: picker, POST `send-property-custom-template-email`, success toast   |
| N/A   | —                                                                                                             | —                                                                                  |
