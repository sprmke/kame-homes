# DESIGN.md reference catalog

Curated extracts from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) for agent inspiration.

| Path                                 | Role                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| **`DESIGN.md` (repo root)**          | **Canonical** Kame Homes / GFM visual system — always prefer this     |
| `.agents/design-md/<slug>/DESIGN.md` | Optional mood/layout references — never override project tokens/brand |

## How agents should use this

1. Read root **`DESIGN.md`** first.
2. Follow GFM skills: `frontend-design`, `brand`, `minimal-ui-copy`, `public-ui`, `design-system`.
3. Only open a reference here when the user asks to match a mood (“more Linear,” “Airbnb-like density”) or when running `stitch-design-taste` / Taste Skill with an explicit inspiration brief.
4. Never copy another brand’s hex/fonts into production UI unless the user explicitly requests a visual experiment.

Refresh refs: `bun run setup:design-md`
