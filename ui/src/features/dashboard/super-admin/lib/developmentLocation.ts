export function suggestDevelopmentLocationLine(city: string, province: string): string {
  return [city.trim(), province.trim()].filter(Boolean).join(', ');
}

export function shouldAutoUpdateDevelopmentLocationLine(
  currentLocationLine: string,
  previousCity: string,
  previousProvince: string
): boolean {
  const trimmed = currentLocationLine.trim();
  if (!trimmed) return true;
  const previousSuggestion = suggestDevelopmentLocationLine(previousCity, previousProvince);
  return trimmed === previousSuggestion;
}
