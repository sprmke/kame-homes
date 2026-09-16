/**
 * House rule id → display catalog (mirrors ui propertyHouseRulesConstants).
 * Keep in sync when admin preset ids change.
 */

export type PublicHouseRuleDto = {
  id: string;
  text: string;
  type: 'info' | 'prohibited' | 'allowed';
};

type HouseRulePreset = {
  id: string;
  name: string;
  type: 'info' | 'prohibited' | 'allowed';
  dynamic?: 'check_in' | 'check_out';
};

const HOUSE_RULE_PRESETS: HouseRulePreset[] = [
  { id: 'check_in_after', name: 'Check-in after', type: 'info', dynamic: 'check_in' },
  { id: 'check_out_before', name: 'Checkout before', type: 'info', dynamic: 'check_out' },
  { id: 'quiet_hours', name: 'Quiet hours: 10 PM - 8 AM', type: 'info' },
  { id: 'no_smoking', name: 'No smoking', type: 'prohibited' },
  { id: 'no_parties', name: 'No parties or events', type: 'prohibited' },
  { id: 'no_shoes_inside', name: 'No shoes inside', type: 'prohibited' },
  { id: 'no_loud_music', name: 'No loud music', type: 'prohibited' },
  { id: 'pets_allowed', name: 'Pets allowed (with approval)', type: 'allowed' },
  { id: 'no_pets', name: 'No pets allowed', type: 'prohibited' },
  { id: 'suitable_for_children', name: 'Suitable for children', type: 'allowed' },
  { id: 'registered_guests_only', name: 'Registered guests only', type: 'info' },
  { id: 'security_cameras', name: 'Security cameras on property', type: 'info' },
  { id: 'self_check_in', name: 'Self check-in', type: 'allowed' },
  { id: 'no_cooking_smelly_food', name: 'No cooking smelly food', type: 'prohibited' },
];

const PRESET_BY_ID = new Map(HOUSE_RULE_PRESETS.map((rule) => [rule.id, rule]));

export function resolvePublicHouseRules(
  enabledIds: string[],
  customRules: Array<{ id: string; name: string }>,
  checkInTime: string,
  checkOutTime: string
): PublicHouseRuleDto[] {
  const customById = new Map<string, string>(
    customRules
      .map((entry) => [entry.id, entry.name.trim()] as const)
      .filter((entry): entry is readonly [string, string] => entry[1].length > 0)
  );
  const resolved: PublicHouseRuleDto[] = [];
  const seen = new Set<string>();

  for (const id of enabledIds) {
    const preset = PRESET_BY_ID.get(id);
    if (preset) {
      let text = preset.name;
      if (preset.dynamic === 'check_in') {
        text = `Check-in: After ${checkInTime}`;
      } else if (preset.dynamic === 'check_out') {
        text = `Checkout: Before ${checkOutTime}`;
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
