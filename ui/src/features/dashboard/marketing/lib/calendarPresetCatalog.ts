/**
 * Calendar layout catalog (names, groups, swatches) without the style data, so
 * modules that only need ids or labels stay out of the heavy preset chunk.
 * Style partials live in `calendarPresets.ts`.
 */

export type CalendarPresetCategory = {
  label: string;
  presets: Array<{
    value: string;
    label: string;
    description: string;
    color: string;
    secondary?: string;
  }>;
};

/** Sidebar picker — categories and preset cards. Soft, pastel-led design system. */
export const CALENDAR_PRESET_CATEGORIES: CalendarPresetCategory[] = [
  {
    label: 'Sweet Social',
    presets: [
      {
        value: 'social-availability',
        label: 'Bubble Pop',
        description: 'Circle-dot days · centered title · lavender pastel',
        color: '#a48ee0',
        secondary: '#f3edfd',
      },
      {
        value: 'sunrise-select',
        label: 'Sunny Widget',
        description: 'Butter widget card · price pill · corner day mark',
        color: '#f2a154',
        secondary: '#fff3da',
      },
    ],
  },
  {
    label: 'Cute Type',
    presets: [
      {
        value: 'desk-type',
        label: 'Desk Buddy',
        description: 'Periwinkle header band · centered giant type',
        color: '#8fa8dc',
        secondary: '#eef3fc',
      },
      {
        value: 'magazine-grid',
        label: 'Zine Soft',
        description: 'Pastel editorial hairlines · left masthead',
        color: '#c98aa0',
        secondary: '#fdf6ef',
      },
    ],
  },
  {
    label: 'Playful Pattern',
    presets: [
      {
        value: 'bauhaus-geo',
        label: 'Confetti Blocks',
        description: 'Pastel color blocks · sticker shadow · rounded',
        color: '#8fb8e8',
        secondary: '#fef0d6',
      },
      {
        value: 'memphis-print',
        label: 'Sprinkle Print',
        description: 'Dot confetti · coral dashes · bubblegum badge',
        color: '#f2879e',
        secondary: '#eaf3fb',
      },
    ],
  },
  {
    label: 'Botanical',
    presets: [
      {
        value: 'boho-soft',
        label: 'Boho Breeze',
        description: 'Borderless · only special days get a pastel dot',
        color: '#e3a488',
        secondary: '#fbf1e8',
      },
      {
        value: 'garden-glow',
        label: 'Garden Bloom',
        description: 'Lush mint blobs · every day in soft color',
        color: '#7fc79e',
        secondary: '#e8f9ee',
      },
    ],
  },
  {
    label: 'Photo Story',
    presets: [
      {
        value: 'property-hero',
        label: 'Sunlit Stay',
        description: 'Blush photo wash · frosted glass · heart corner',
        color: '#ef9c85',
        secondary: '#fdece5',
      },
      {
        value: 'cabin-retreat',
        label: 'Cabin Glow',
        description: 'Warm photo overlay · chunky rounded · nav pills',
        color: '#d9a184',
        secondary: '#fbeee3',
      },
    ],
  },
  {
    label: 'Twilight',
    presets: [
      {
        value: 'velvet-guest',
        label: 'Dreamy Dusk',
        description: 'Soft lilac dusk gradient · guest-name spans',
        color: '#b48bd9',
        secondary: '#f3e8fb',
      },
      {
        value: 'gold-foil',
        label: 'Rose Gold',
        description: 'Blush plaque · rose-gold double border',
        color: '#e0a8a0',
        secondary: '#fbe9ec',
      },
    ],
  },
  {
    label: 'Paper & Ink',
    presets: [
      {
        value: 'ring-bloom',
        label: 'Ring Bloom',
        description: 'Thin gold rings on every day · elegant circles',
        color: '#c9a86a',
        secondary: '#fdf6ee',
      },
      {
        value: 'petal-note',
        label: 'Petal Note',
        description: 'No cell fills. States read purely by ink color',
        color: '#e8a186',
        secondary: '#fbe0d9',
      },
    ],
  },
];

export const CALENDAR_DESIGNER_PRESET_IDS = CALENDAR_PRESET_CATEGORIES.flatMap((c) =>
  c.presets.map((p) => p.value)
);
