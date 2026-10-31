---
title: Smart concept suggestions
status: done
stage: done
tags: [workflow, done, search, marketing, typeahead]
updated: 2026-08-06
---

**Shipped (2026-08-05)** as part of [`smart-search-bar.md`](./smart-search-bar.md) — `search-suggestions` concept branch + `resolveSearchIntent` shared with `search-listings`.

# Smart concept suggestions

## Problem

Typing common nouns like **Condo**, **Beaches**, or **Mountain** in Where shows **No matches**, even though `/search` already resolves those as concept intents and the homepage chips advertise the same ideas. Typeahead only did literal name/city `ilike`; Nearby already had a special chip, concepts did not.

## Decisions (approved)

1. **Dropdown:** concept chip first (e.g. Condos · Browse condo stays) **plus** a few matching listing previews.
2. **Chip navigate:** `/search?where=<concept>` with concept results across families; Properties prioritized when the concept prefers stays.
3. **Preview mix:** hard type matches first (`CONDO`, `HOUSE`…), then synonym/place term fill.
4. **Places this round:** keep literal search; boost exact / prefix / word-start ranking only (no fuzzy/typo engine).
5. **Architecture:** deterministic — extend `search-suggestions` with `resolveSearchIntent` (same module as `search-listings`). No LLM in typeahead.

## Behavior

| Input                          | Typeahead                   | Submit                                     |
| ------------------------------ | --------------------------- | ------------------------------------------ |
| Nearby / Nearby properties     | Existing Nearby chip        | Geo radius results                         |
| Condo / Beaches / Mountain / … | Concept chip + previews     | `search-listings` concept mode (unchanged) |
| Manila / Azure / Kame          | Literal groups, better rank | Literal (+ soft concept fallback if 0)     |

Empty inventory for a concept still shows the chip (never a false “No matches”); submit may still return 0 if nothing matches expansion.

## Out of scope

- Fuzzy / typo tolerance
- Embedding / LLM rewrite (existing Phase 2 note on `/search`)
- Changing homepage destination chips beyond staying consistent with concept labels

## Implementation map

- `supabase/functions/search-suggestions/index.ts` — concept branch + ranked previews
- `supabase/functions/_shared/searchIntents.ts` — shared subtitle / preferType helpers if needed
- `supabase/functions/_shared/publicSearch.ts` — word-start rank boost
- `ui/.../searchIntents.ts` — mirror preferType + propertyTypes; `canBridgeConceptToListPublic`
- `ui/.../searchFilterParams.ts` — strip concept `where`; hard `type` for list-public; gate synonym-only concepts
- `ui/.../SearchResultsPage.tsx` — use public list only when bridgeable
- `ui/.../HeroSearch.tsx` — select `concept:*` → `/search`
- `docs/guides/routes/search.md` — document typeahead concept chips + filter bridge
