export type PricingHolidayRuleDto = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  percentage: number;
};

export type PricingHolidayRule = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  percentage: number;
  color: string;
};

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Philippine holidays — seeded in DB; used when property has no custom rules. */
export const PH_PRICING_HOLIDAYS_2026: PricingHolidayRule[] = [
  {
    id: 'new-year',
    name: "New Year's Day",
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 0, 1),
    percentage: 50,
    color: 'bg-red-500',
  },
  {
    id: 'chinese-new-year',
    name: 'Chinese New Year',
    startDate: new Date(2026, 1, 17),
    endDate: new Date(2026, 1, 17),
    percentage: 30,
    color: 'bg-red-500',
  },
  {
    id: 'holy-week',
    name: 'Holy Week',
    startDate: new Date(2026, 3, 2),
    endDate: new Date(2026, 3, 5),
    percentage: 40,
    color: 'bg-purple-500',
  },
  {
    id: 'labor-day',
    name: 'Labor Day',
    startDate: new Date(2026, 4, 1),
    endDate: new Date(2026, 4, 1),
    percentage: 20,
    color: 'bg-blue-500',
  },
  {
    id: 'independence',
    name: 'Independence Day',
    startDate: new Date(2026, 5, 12),
    endDate: new Date(2026, 5, 12),
    percentage: 30,
    color: 'bg-blue-500',
  },
  {
    id: 'peak-july',
    name: 'Peak season',
    startDate: new Date(2026, 6, 4),
    endDate: new Date(2026, 6, 4),
    percentage: 25,
    color: 'bg-red-500',
  },
  {
    id: 'all-saints',
    name: "All Saints' Day",
    startDate: new Date(2026, 10, 1),
    endDate: new Date(2026, 10, 2),
    percentage: 30,
    color: 'bg-purple-500',
  },
  {
    id: 'christmas',
    name: 'Christmas Season',
    startDate: new Date(2026, 11, 24),
    endDate: new Date(2026, 11, 26),
    percentage: 50,
    color: 'bg-green-500',
  },
  {
    id: 'new-year-eve',
    name: "New Year's Eve",
    startDate: new Date(2026, 11, 31),
    endDate: new Date(2026, 11, 31),
    percentage: 50,
    color: 'bg-red-500',
  },
];

export const DEFAULT_PRICING_HOLIDAY_RULES_DTO: PricingHolidayRuleDto[] =
  PH_PRICING_HOLIDAYS_2026.map((rule) => ({
    id: rule.id,
    name: rule.name,
    startDate: formatYmd(rule.startDate),
    endDate: formatYmd(rule.endDate),
    percentage: rule.percentage,
  }));

export function holidayRulesFromDto(dtos?: PricingHolidayRuleDto[] | null): PricingHolidayRule[] {
  const source = dtos && dtos.length > 0 ? dtos : DEFAULT_PRICING_HOLIDAY_RULES_DTO;
  return source.map((dto) => ({
    id: dto.id,
    name: dto.name,
    startDate: parseYmd(dto.startDate),
    endDate: parseYmd(dto.endDate),
    percentage: dto.percentage,
    color: 'bg-primary',
  }));
}

export function findHolidayRuleDtoForDateKey(
  dateKey: string,
  rules: PricingHolidayRuleDto[]
): PricingHolidayRuleDto | undefined {
  return rules.find((r) => dateKey >= r.startDate && dateKey <= r.endDate);
}

export function findHolidayRuleForDate(
  date: Date,
  rules: PricingHolidayRuleDto[]
): PricingHolidayRule | undefined {
  const key = formatYmd(date);
  const dto = findHolidayRuleDtoForDateKey(key, rules);
  if (!dto) return undefined;
  return {
    id: dto.id,
    name: dto.name,
    startDate: parseYmd(dto.startDate),
    endDate: parseYmd(dto.endDate),
    percentage: dto.percentage,
    color: 'bg-primary',
  };
}
