import { Ban, Clock, Home, Users, type LucideIcon } from 'lucide-react';

export const HOUSE_RULE_CUSTOM_MAX_LENGTH = 50;

export type HouseRuleDisplayType = 'info' | 'prohibited' | 'allowed';

export type CustomHouseRule = {
  id: string;
  name: string;
  categoryId: string;
};

export type HouseRulePreset = {
  id: string;
  name: string;
  type: HouseRuleDisplayType;
  /** Substitute property check-in/out times when resolving for public display */
  dynamic?: 'check_in' | 'check_out';
};

export type HouseRuleCategory = {
  id: string;
  name: string;
  icon: LucideIcon;
  rules: HouseRulePreset[];
};

export const HOUSE_RULE_CATEGORIES: HouseRuleCategory[] = [
  {
    id: 'timing',
    name: 'Check-in & timing',
    icon: Clock,
    rules: [
      { id: 'check_in_after', name: 'Check-in after', type: 'info', dynamic: 'check_in' },
      { id: 'check_out_before', name: 'Checkout before', type: 'info', dynamic: 'check_out' },
      { id: 'quiet_hours', name: 'Quiet hours: 10 PM - 8 AM', type: 'info' },
    ],
  },
  {
    id: 'restrictions',
    name: 'Restrictions',
    icon: Ban,
    rules: [
      { id: 'no_smoking', name: 'No smoking', type: 'prohibited' },
      { id: 'no_parties', name: 'No parties or events', type: 'prohibited' },
      { id: 'no_shoes_inside', name: 'No shoes inside', type: 'prohibited' },
      { id: 'no_loud_music', name: 'No loud music', type: 'prohibited' },
    ],
  },
  {
    id: 'guests_pets',
    name: 'Guests & pets',
    icon: Users,
    rules: [
      { id: 'pets_allowed', name: 'Pets allowed (with approval)', type: 'allowed' },
      { id: 'no_pets', name: 'No pets allowed', type: 'prohibited' },
      { id: 'suitable_for_children', name: 'Suitable for children', type: 'allowed' },
      { id: 'registered_guests_only', name: 'Registered guests only', type: 'info' },
    ],
  },
  {
    id: 'property',
    name: 'Property',
    icon: Home,
    rules: [
      { id: 'security_cameras', name: 'Security cameras on property', type: 'info' },
      { id: 'self_check_in', name: 'Self check-in', type: 'allowed' },
      { id: 'no_cooking_smelly_food', name: 'No cooking smelly food', type: 'prohibited' },
    ],
  },
];

const HOUSE_RULE_PRESET_ENTRIES: [string, HouseRulePreset][] = HOUSE_RULE_CATEGORIES.flatMap(
  (category) => category.rules.map((rule): [string, HouseRulePreset] => [rule.id, rule])
);

export const HOUSE_RULE_PRESET_BY_ID = new Map(HOUSE_RULE_PRESET_ENTRIES);

/** Presets enabled for new properties (hosts can change in settings). */
export const INITIAL_ENABLED_HOUSE_RULES = [
  'check_in_after',
  'check_out_before',
  'no_smoking',
  'no_parties',
  'quiet_hours',
  'pets_allowed',
  'suitable_for_children',
  'security_cameras',
];

export const MUTUALLY_EXCLUSIVE_HOUSE_RULES: Record<string, string> = {
  pets_allowed: 'no_pets',
  no_pets: 'pets_allowed',
};

export type ResolvedHouseRule = {
  id: string;
  text: string;
  type: HouseRuleDisplayType;
};

export function resolveHouseRulesForDisplay(input: {
  enabledIds: string[];
  customRules: Array<{ id: string; name: string }>;
  checkInTime: string;
  checkOutTime: string;
}): ResolvedHouseRule[] {
  const customById = new Map<string, string>(
    input.customRules
      .map((entry) => [entry.id, entry.name.trim()] as const)
      .filter(([, name]) => Boolean(name))
  );
  const resolved: ResolvedHouseRule[] = [];
  const seen = new Set<string>();

  for (const id of input.enabledIds) {
    const preset = HOUSE_RULE_PRESET_BY_ID.get(id);
    if (preset) {
      let text = preset.name;
      if (preset.dynamic === 'check_in') {
        text = `Check-in: After ${input.checkInTime}`;
      } else if (preset.dynamic === 'check_out') {
        text = `Checkout: Before ${input.checkOutTime}`;
      }
      if (seen.has(text)) continue;
      seen.add(text);
      resolved.push({ id, text, type: preset.type });
      continue;
    }

    const customName = customById.get(id);
    if (!customName || seen.has(customName)) continue;
    seen.add(customName);
    resolved.push({ id, text: customName, type: 'info' });
  }

  return resolved;
}
