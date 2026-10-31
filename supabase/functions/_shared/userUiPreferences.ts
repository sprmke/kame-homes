/**
 * Per-user dashboard UI preferences (`public.user_ui_preferences`).
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 2).
 */

export const DASHBOARD_MODES = ['advanced', 'ai'] as const;
export type DashboardMode = (typeof DASHBOARD_MODES)[number];

export type UserUiPreferences = {
  dashboardMode: DashboardMode;
  updatedAt: string | null;
};

export const DEFAULT_USER_UI_PREFERENCES: UserUiPreferences = {
  dashboardMode: 'advanced',
  updatedAt: null,
};

export function isDashboardMode(value: unknown): value is DashboardMode {
  return typeof value === 'string' && (DASHBOARD_MODES as readonly string[]).includes(value);
}

export type UserUiPreferencesPatch = { dashboardMode: DashboardMode };

/** Validates a PATCH body. Unknown keys are rejected so typos never silently no-op. */
export function parseUserUiPreferencesPatch(
  body: Record<string, unknown>
): { ok: true; patch: UserUiPreferencesPatch } | { ok: false; error: string } {
  const unknownKeys = Object.keys(body).filter((key) => key !== 'dashboardMode');
  if (unknownKeys.length > 0) {
    return { ok: false, error: `Unknown field: ${unknownKeys[0]}` };
  }
  if (!isDashboardMode(body.dashboardMode)) {
    return { ok: false, error: "dashboardMode must be 'advanced' or 'ai'" };
  }
  return { ok: true, patch: { dashboardMode: body.dashboardMode } };
}

export function mapUserUiPreferencesRow(
  row: { dashboard_mode?: unknown; updated_at?: unknown } | null
): UserUiPreferences {
  if (!row) return DEFAULT_USER_UI_PREFERENCES;
  return {
    dashboardMode: isDashboardMode(row.dashboard_mode) ? row.dashboard_mode : 'advanced',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}
