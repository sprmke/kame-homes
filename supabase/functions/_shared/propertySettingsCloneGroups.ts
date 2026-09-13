/**
 * Clone group implementations for copy-property-settings.
 * Phase 1 safe groups + Phase 2/3 stubs registered when assets/recurring land.
 */

import {
  getAiPlatformPropertySettings,
  upsertAiPlatformPropertySettings,
} from './aiUsageService.ts';
import {
  getMarketingGenerationOverrides,
  patchMarketingGenerationOverrides,
} from './marketingGenerationFeatureConfig.ts';
import { updateCustomPageTemplate, type CustomPageType } from './customPages.ts';
import { createServiceClient } from './orgAuth.ts';
import { mergePropertyAutomationToggles } from './propertyAutomationToggles.ts';
import { clampToRange, getResidencePropertyDefaults } from './propertyResidenceDefaults.ts';
import { loadPropertyPricing, savePropertyPricing } from './propertyPricing.ts';
import {
  getOrCreatePublicPageConfig,
  upsertPublicPageConfig,
  type PublicPageType,
} from './publicPageConfigs.ts';
import {
  listPropertyTemplateRows,
  upsertPropertyTemplateRow,
  type PropertyTemplateCategory,
} from './propertyTemplates.ts';
import { isSeededTemplateName, seedPropertyTeamTemplates } from './propertyTeamTemplates.ts';
import { normalizePermissionIds } from './propertyTeamPermissions.ts';
import {
  DEFAULT_SMART_PRICING_SETTINGS,
  loadSmartPricingSettings,
  saveSmartPricingSettings,
} from './smartPricing.ts';
import {
  getVoiceReceptionistSettings,
  updateVoiceReceptionistSettings,
} from './voiceReceptionistService.ts';
import {
  denylistCopyTableRow,
  loadAppSettingsColumns,
  loadPropertyRow,
  patchAppSettingsColumns,
  patchPropertySettings,
  pickKeys,
  settingsHasAny,
} from './propertySettingsCloneHelpers.ts';
import type {
  CloneGroup,
  CloneOptions,
  ClonePropertyCtx,
  GroupPayload,
} from './propertySettingsCloneTypes.ts';

const PROPERTY_DETAILS_KEYS = [
  'bedrooms',
  'bathrooms',
  'floors',
  'unitTypeId',
  'maxAdults',
  'maxChildren',
  'checkInTime',
  'checkOutTime',
  'selfCheckIn',
] as const;

const LISTING_CONTENT_KEYS = ['description'] as const;
const AMENITIES_KEYS = ['enabledAmenities', 'customAmenities'] as const;
const HOUSE_RULES_KEYS = ['enabledHouseRules', 'customHouseRules'] as const;
const CANCELLATION_KEYS = ['cancellationPolicy'] as const;
const GUEST_FORM_KEYS = [
  'allowPets',
  'allowParking',
  'allowSurpriseDecor',
  'complimentaryOwnerParking',
  'cleaningBufferMinutes',
  'preferredOwnerParkingId',
] as const;
const CONTACT_KEYS = ['contactName', 'contactRole', 'contactPhone', 'contactEmail'] as const;
const INBOX_SNIPPET_KEYS = ['inboxPinnedSnippets'] as const;

const BRANDING_COLUMNS = [
  'brand_color',
  'facebook_reviews_url',
  'airbnb_url',
  'instagram_url',
  'tiktok_url',
] as const;

const VOUCHER_COLUMNS = ['vouchers_enabled', 'voucher_prizes', 'voucher_reveal_style'] as const;

const EMAIL_AUTOMATION_COLUMNS = [
  'automation_toggles',
  'sd_refund_cron_email_lead_minutes',
  'sd_refund_cron_max_checkout_age_days',
] as const;

const EMAIL_RECIPIENT_COLUMNS = ['email_reply_to', 'parking_owner_emails'] as const;

const TELEGRAM_TABLES = [
  'telegram_marketing_settings',
  'telegram_staff_settings',
  'telegram_admin_settings',
  'telegram_finance_settings',
  'telegram_maintenance_settings',
  'telegram_chat_settings',
] as const;

const TELEGRAM_DENY = [
  'id',
  'property_id',
  'created_at',
  'updated_at',
  'google_calendar_id',
  'google_spreadsheet_id',
] as const;

const TELEGRAM_CREDENTIALS = ['bot_token_encrypted', 'chat_id_encrypted'] as const;

function settingsKeysGroup(args: {
  id: CloneGroup['id'];
  label: string;
  editLeaves: CloneGroup['editLeaves'];
  keys: readonly string[];
  defaultOn: boolean;
  planFeature?: CloneGroup['planFeature'];
  sanitizeExtra?: (
    picked: Record<string, unknown>,
    targetCtx: ClonePropertyCtx,
    options: CloneOptions
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  columnFromSettings?: (picked: Record<string, unknown>) => Record<string, unknown> | undefined;
}): CloneGroup {
  const { id, label, editLeaves, keys, defaultOn, planFeature, sanitizeExtra, columnFromSettings } =
    args;
  return {
    id,
    label,
    editLeaves,
    planFeature,
    defaultOn,
    async read(sourceCtx) {
      const row = await loadPropertyRow(sourceCtx.propertyId);
      return pickKeys(row.settings, keys);
    },
    sanitize(payload, targetCtx, options) {
      const base = pickKeys(payload, keys);
      if (sanitizeExtra) {
        const maybe = sanitizeExtra(base, targetCtx, options);
        if (maybe instanceof Promise) {
          throw new Error(`${id}: sanitizeExtra must be sync for this group`);
        }
        return maybe;
      }
      return base;
    },
    async hasNonDefault(targetCtx) {
      const row = await loadPropertyRow(targetCtx.propertyId);
      return settingsHasAny(row.settings, keys);
    },
    async write(payload, targetCtx) {
      const picked = pickKeys(payload, keys);
      const columns = columnFromSettings?.(picked);
      await patchPropertySettings(targetCtx.propertyId, picked, columns);
    },
  };
}

const propertyDetailsGroup: CloneGroup = {
  id: 'propertyDetails',
  label: 'Property details',
  editLeaves: ['settings.propertyDetails:edit'],
  defaultOn: true,
  async read(sourceCtx) {
    const row = await loadPropertyRow(sourceCtx.propertyId);
    return {
      ...pickKeys(row.settings, PROPERTY_DETAILS_KEYS),
      max_guests: row.max_guests,
      _sourceResidence: row.residence_name,
    };
  },
  sanitize(payload, targetCtx) {
    // sync sanitize — clamp happens in write with target residence
    return { ...payload, _targetPropertyId: targetCtx.propertyId };
  },
  async hasNonDefault(targetCtx) {
    const row = await loadPropertyRow(targetCtx.propertyId);
    return settingsHasAny(row.settings, PROPERTY_DETAILS_KEYS) || row.max_guests != null;
  },
  async write(payload, targetCtx) {
    const target = await loadPropertyRow(targetCtx.propertyId);
    const defaults = getResidencePropertyDefaults(
      (target.residence_name ?? '').trim() || 'Azure North Residences'
    );
    const settingsPatch: Record<string, unknown> = {};
    const num = (v: unknown, range: { min: number; max: number; default: number }) =>
      clampToRange(Number(v), range);

    if (payload.bedrooms !== undefined) {
      settingsPatch.bedrooms = num(payload.bedrooms, defaults.bedrooms);
    }
    if (payload.bathrooms !== undefined) {
      settingsPatch.bathrooms = num(payload.bathrooms, defaults.bathrooms);
    }
    if (payload.floors !== undefined) {
      settingsPatch.floors = num(payload.floors, defaults.floors);
    }
    if (payload.maxAdults !== undefined) {
      settingsPatch.maxAdults = num(payload.maxAdults, defaults.maxAdults);
    }
    if (payload.maxChildren !== undefined) {
      settingsPatch.maxChildren = num(payload.maxChildren, defaults.maxChildren);
    }
    if (typeof payload.unitTypeId === 'string') settingsPatch.unitTypeId = payload.unitTypeId;
    if (typeof payload.checkInTime === 'string') settingsPatch.checkInTime = payload.checkInTime;
    if (typeof payload.checkOutTime === 'string') settingsPatch.checkOutTime = payload.checkOutTime;
    if (typeof payload.selfCheckIn === 'boolean') settingsPatch.selfCheckIn = payload.selfCheckIn;

    const maxAdults =
      typeof settingsPatch.maxAdults === 'number'
        ? settingsPatch.maxAdults
        : Number(target.settings.maxAdults ?? defaults.maxAdults.default);
    const maxChildren =
      typeof settingsPatch.maxChildren === 'number'
        ? settingsPatch.maxChildren
        : Number(target.settings.maxChildren ?? defaults.maxChildren.default);
    const maxGuests = Math.max(1, maxAdults + maxChildren);

    await patchPropertySettings(targetCtx.propertyId, settingsPatch, { max_guests: maxGuests });
  },
};

async function sanitizeGuestForm(
  picked: Record<string, unknown>,
  targetCtx: ClonePropertyCtx
): Promise<Record<string, unknown>> {
  const out = { ...picked };
  const preferred =
    typeof out.preferredOwnerParkingId === 'string' ? out.preferredOwnerParkingId : null;
  if (!preferred) return out;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('parkings')
    .select('id')
    .eq('id', preferred)
    .eq('organization_id', targetCtx.organizationId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (!data) {
    delete out.preferredOwnerParkingId;
  }
  return out;
}

const guestFormGroup: CloneGroup = {
  id: 'guestForm',
  label: 'Guest form toggles',
  editLeaves: ['settings.guestForm:edit'],
  defaultOn: true,
  async read(sourceCtx) {
    const row = await loadPropertyRow(sourceCtx.propertyId);
    return pickKeys(row.settings, GUEST_FORM_KEYS);
  },
  sanitize(payload) {
    return pickKeys(payload, GUEST_FORM_KEYS);
  },
  async hasNonDefault(targetCtx) {
    const row = await loadPropertyRow(targetCtx.propertyId);
    return settingsHasAny(row.settings, GUEST_FORM_KEYS);
  },
  async write(payload, targetCtx) {
    const sanitized = await sanitizeGuestForm(pickKeys(payload, GUEST_FORM_KEYS), targetCtx);
    await patchPropertySettings(targetCtx.propertyId, sanitized);
  },
};

const contactGroup: CloneGroup = {
  ...settingsKeysGroup({
    id: 'contact',
    label: 'Contact details',
    editLeaves: ['settings.basicInfo:edit'],
    keys: CONTACT_KEYS,
    defaultOn: false,
  }),
  sanitize(payload, _ctx, options) {
    if (!options.copyContact) return {};
    return pickKeys(payload, CONTACT_KEYS);
  },
  async write(payload, targetCtx, options) {
    if (!options.copyContact) return;
    await patchPropertySettings(targetCtx.propertyId, pickKeys(payload, CONTACT_KEYS));
  },
};

const brandingGroup: CloneGroup = {
  id: 'branding',
  label: 'Brand & socials',
  editLeaves: ['settings.basicInfo:edit', 'settings.socials:edit'],
  defaultOn: true,
  async read(sourceCtx) {
    return loadAppSettingsColumns(sourceCtx.propertyId, [...BRANDING_COLUMNS]);
  },
  sanitize(payload) {
    return pickKeys(payload, BRANDING_COLUMNS);
  },
  async hasNonDefault(targetCtx) {
    const row = await loadAppSettingsColumns(targetCtx.propertyId, [...BRANDING_COLUMNS]);
    return Object.values(row).some((v) => v != null && String(v).trim() !== '');
  },
  async write(payload, targetCtx) {
    await patchAppSettingsColumns(targetCtx.propertyId, pickKeys(payload, BRANDING_COLUMNS));
  },
};

const emailAutomationsGroup: CloneGroup = {
  id: 'emailAutomations',
  label: 'Email automations',
  editLeaves: ['settings.emailAutomations:edit'],
  defaultOn: true,
  async read(sourceCtx) {
    const cols = [...EMAIL_AUTOMATION_COLUMNS, ...EMAIL_RECIPIENT_COLUMNS];
    return loadAppSettingsColumns(sourceCtx.propertyId, cols);
  },
  sanitize(payload, _ctx, options) {
    const out = pickKeys(payload, EMAIL_AUTOMATION_COLUMNS);
    if (out.automation_toggles) {
      out.automation_toggles = mergePropertyAutomationToggles(out.automation_toggles);
    }
    if (options.copyEmailRecipients) {
      Object.assign(out, pickKeys(payload, EMAIL_RECIPIENT_COLUMNS));
    }
    return out;
  },
  async hasNonDefault(targetCtx) {
    const row = await loadAppSettingsColumns(targetCtx.propertyId, [
      ...EMAIL_AUTOMATION_COLUMNS,
      ...EMAIL_RECIPIENT_COLUMNS,
    ]);
    return Object.values(row).some((v) => v != null);
  },
  async write(payload, targetCtx, options) {
    const cols = pickKeys(payload, EMAIL_AUTOMATION_COLUMNS);
    if (options.copyEmailRecipients) {
      Object.assign(cols, pickKeys(payload, EMAIL_RECIPIENT_COLUMNS));
    }
    await patchAppSettingsColumns(targetCtx.propertyId, cols);
  },
};

const pricingRatesGroup: CloneGroup = {
  id: 'pricingRates',
  label: 'Rates & fees',
  editLeaves: ['pricing.rates:edit'],
  defaultOn: true,
  async read(sourceCtx) {
    const pricing = await loadPropertyPricing(sourceCtx.propertyId);
    return {
      weekdayNightlyRate: pricing.weekdayNightlyRate,
      weekendNightlyRate: pricing.weekendNightlyRate,
      downPayment: pricing.downPayment,
      securityDeposit: pricing.securityDeposit,
      petFee: pricing.petFee,
      parkingRateGuest: pricing.parkingRateGuest,
      guestAdditionalFee: pricing.guestAdditionalFee,
      holidayRules: pricing.holidayRules,
    };
  },
  sanitize(payload) {
    return { ...payload };
  },
  async hasNonDefault() {
    return true;
  },
  async write(payload, targetCtx) {
    await savePropertyPricing(targetCtx.propertyId, {
      weekdayNightlyRate: Number(payload.weekdayNightlyRate),
      weekendNightlyRate: Number(payload.weekendNightlyRate),
      downPayment: Number(payload.downPayment),
      securityDeposit: Number(payload.securityDeposit),
      petFee: Number(payload.petFee),
      parkingRateGuest: Number(payload.parkingRateGuest),
      guestAdditionalFee: Number(payload.guestAdditionalFee),
      holidayRules: Array.isArray(payload.holidayRules)
        ? (payload.holidayRules as Parameters<typeof savePropertyPricing>[1]['holidayRules'])
        : undefined,
    });
  },
};

const smartPricingGroup: CloneGroup = {
  id: 'smartPricing',
  label: 'Smart Pricing',
  editLeaves: ['pricing.rates:edit'],
  planFeature: 'smartPricing',
  defaultOn: true,
  async read(sourceCtx) {
    const settings = await loadSmartPricingSettings(sourceCtx.propertyId);
    const { lastRunAt: _last, ...copyable } = settings;
    return { ...copyable };
  },
  sanitize(payload) {
    const { lastRunAt: _l, ...rest } = payload as Record<string, unknown>;
    return rest;
  },
  async hasNonDefault(targetCtx) {
    const settings = await loadSmartPricingSettings(targetCtx.propertyId);
    return JSON.stringify(settings) !== JSON.stringify(DEFAULT_SMART_PRICING_SETTINGS);
  },
  async write(payload, targetCtx) {
    await saveSmartPricingSettings(
      targetCtx.propertyId,
      payload as Parameters<typeof saveSmartPricingSettings>[1]
    );
  },
};

const voucherConfigGroup: CloneGroup = {
  id: 'voucherConfig',
  label: 'Voucher config',
  editLeaves: ['settings.socials:edit'],
  defaultOn: true,
  async read(sourceCtx) {
    return loadAppSettingsColumns(sourceCtx.propertyId, [...VOUCHER_COLUMNS]);
  },
  sanitize(payload) {
    return pickKeys(payload, VOUCHER_COLUMNS);
  },
  async hasNonDefault(targetCtx) {
    const row = await loadAppSettingsColumns(targetCtx.propertyId, [...VOUCHER_COLUMNS]);
    return Boolean(row.vouchers_enabled) || row.voucher_prizes != null;
  },
  async write(payload, targetCtx) {
    await patchAppSettingsColumns(targetCtx.propertyId, pickKeys(payload, VOUCHER_COLUMNS));
  },
};

const publicPagesGroup: CloneGroup = {
  id: 'publicPages',
  label: 'Public pages',
  editLeaves: [
    'publicPages.property:edit',
    'publicPages.stayGuide:edit',
    'publicPages.showcase:edit',
  ],
  defaultOn: true,
  async read(sourceCtx) {
    const supabase = createServiceClient();
    const [{ data: customPages }, { data: pageConfigs }] = await Promise.all([
      supabase
        .from('custom_pages')
        .select('page_type, template_key')
        .eq('property_id', sourceCtx.propertyId),
      supabase
        .from('public_page_configs')
        .select('page_type, config')
        .eq('property_id', sourceCtx.propertyId),
    ]);
    return {
      customPages: customPages ?? [],
      pageConfigs: pageConfigs ?? [],
    };
  },
  sanitize(payload) {
    const customPages = Array.isArray(payload.customPages) ? payload.customPages : [];
    const pageConfigs = Array.isArray(payload.pageConfigs)
      ? (payload.pageConfigs as Array<{ page_type: string; config: Record<string, unknown> }>).map(
          (row) => {
            const config = { ...(row.config ?? {}) };
            if ('published' in config) config.published = false;
            return { page_type: row.page_type, config };
          }
        )
      : [];
    return { customPages, pageConfigs };
  },
  async hasNonDefault(targetCtx) {
    const supabase = createServiceClient();
    const { count } = await supabase
      .from('public_page_configs')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', targetCtx.propertyId);
    return (count ?? 0) > 0;
  },
  async write(payload, targetCtx) {
    const customPages = Array.isArray(payload.customPages)
      ? (payload.customPages as Array<{ page_type: string; template_key: string }>)
      : [];
    for (const row of customPages) {
      const pageType = row.page_type as CustomPageType;
      if (pageType !== 'stay_guide' && pageType !== 'property_showcase') continue;
      await updateCustomPageTemplate(targetCtx.propertyId, pageType, row.template_key);
    }

    const pageConfigs = Array.isArray(payload.pageConfigs)
      ? (payload.pageConfigs as Array<{ page_type: string; config: Record<string, unknown> }>)
      : [];
    for (const row of pageConfigs) {
      const pageType = row.page_type as PublicPageType;
      if (
        pageType !== 'stay_guide' &&
        pageType !== 'property_landing' &&
        pageType !== 'property_showcase'
      ) {
        continue;
      }
      await getOrCreatePublicPageConfig(targetCtx.propertyId, pageType);
      const config = { ...(row.config ?? {}) };
      if ('published' in config) config.published = false;
      await upsertPublicPageConfig(targetCtx.propertyId, pageType, config);
    }
  },
};

const templatesGroup: CloneGroup = {
  id: 'templates',
  label: 'Templates',
  editLeaves: ['templates.standard:edit', 'templates.email:edit'],
  defaultOn: true,
  async read(sourceCtx) {
    const rows = await listPropertyTemplateRows(sourceCtx.propertyId);
    return {
      rows: rows.map((r) => ({
        template_key: r.template_key,
        category: r.category,
        name: r.name,
        content: r.content,
        section_image_url: r.section_image_url,
      })),
    };
  },
  sanitize(payload) {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return {
      rows: rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          template_key: row.template_key,
          category: row.category,
          name: row.name,
          content: row.content,
          // Phase 1: text only — drop section images (Phase 2 clones them)
          section_image_url: null,
        };
      }),
    };
  },
  async hasNonDefault(targetCtx) {
    const rows = await listPropertyTemplateRows(targetCtx.propertyId);
    return rows.length > 0;
  },
  async write(payload, targetCtx) {
    const rows = Array.isArray(payload.rows)
      ? (payload.rows as Array<{
          template_key: string;
          category: PropertyTemplateCategory;
          name: string | null;
          content: string;
          section_image_url: string | null;
        }>)
      : [];
    for (const row of rows) {
      await upsertPropertyTemplateRow({
        propertyId: targetCtx.propertyId,
        templateKey: String(row.template_key),
        category: row.category,
        name: row.name,
        content: String(row.content ?? ''),
        sectionImageUrl: null,
      });
    }
  },
};

const telegramNotificationsGroup: CloneGroup = {
  id: 'telegramNotifications',
  label: 'Telegram notifications',
  editLeaves: [
    'notifications.marketing:edit',
    'notifications.staff:edit',
    'notifications.operations:edit',
    'notifications.finance:edit',
    'notifications.maintenance:edit',
    'notifications.chat:edit',
  ],
  planFeature: 'telegramNotifications',
  defaultOn: true,
  async read(sourceCtx) {
    const sharedBot = await loadAppSettingsColumns(sourceCtx.propertyId, [
      'telegram_global_bot_token_encrypted',
    ]);
    return { sharedBot, _sourcePropertyId: sourceCtx.propertyId };
  },
  sanitize(payload) {
    return payload;
  },
  async hasNonDefault(targetCtx) {
    const row = await loadAppSettingsColumns(targetCtx.propertyId, [
      'telegram_global_bot_token_encrypted',
    ]);
    return Boolean(row.telegram_global_bot_token_encrypted);
  },
  async write(payload, targetCtx, options) {
    const sharedBot = (payload.sharedBot as Record<string, unknown> | undefined) ?? {};
    if (sharedBot.telegram_global_bot_token_encrypted !== undefined) {
      await patchAppSettingsColumns(targetCtx.propertyId, {
        telegram_global_bot_token_encrypted: sharedBot.telegram_global_bot_token_encrypted,
      });
    }
    const sourcePropertyId = String(payload._sourcePropertyId ?? '');
    if (!sourcePropertyId) throw new Error('Missing source property for telegram copy');
    for (const table of TELEGRAM_TABLES) {
      await denylistCopyTableRow({
        table,
        sourcePropertyId,
        targetPropertyId: targetCtx.propertyId,
        denyKeys: TELEGRAM_DENY,
        includeCredentialKeys: Boolean(options.copyTelegramCredentials),
        credentialKeys: TELEGRAM_CREDENTIALS,
      });
    }
  },
};

const voiceReceptionistGroup: CloneGroup = {
  id: 'voiceReceptionist',
  label: 'Voice receptionist',
  editLeaves: ['settings.voiceReceptionist:edit'],
  planFeature: 'aiReceptionist',
  defaultOn: true,
  async read(sourceCtx) {
    const settings = await getVoiceReceptionistSettings(sourceCtx.propertyId);
    return { ...settings };
  },
  sanitize(payload) {
    return { ...payload };
  },
  async hasNonDefault(targetCtx) {
    const settings = await getVoiceReceptionistSettings(targetCtx.propertyId);
    return Boolean(settings.enabled) || Boolean(settings.personaPrompt?.trim());
  },
  async write(payload, targetCtx) {
    await updateVoiceReceptionistSettings(targetCtx.propertyId, {
      enabled: payload.enabled as boolean | undefined,
      voiceId: payload.voiceId as string | undefined,
      personaPrompt: payload.personaPrompt as string | undefined,
      maxSessionSeconds: payload.maxSessionSeconds as number | undefined,
      maxSessionsPerGuestPerDay: payload.maxSessionsPerGuestPerDay as number | undefined,
      maxConcurrentSessions: payload.maxConcurrentSessions as number | undefined,
    });
  },
};

const aiOverridesGroup: CloneGroup = {
  id: 'aiOverrides',
  label: 'AI overrides',
  editLeaves: ['settings.aiOverrides:edit'],
  planFeature: 'aiMonthlyCreditAllowance',
  defaultOn: true,
  async read(sourceCtx) {
    const settings = await getAiPlatformPropertySettings(
      sourceCtx.propertyId,
      sourceCtx.organizationId
    );
    const generation = await getMarketingGenerationOverrides(
      sourceCtx.propertyId,
      sourceCtx.organizationId
    );
    return {
      enabled: settings.enabled,
      dailyCallLimit: settings.dailyCallLimit,
      monthlyCallLimit: settings.monthlyCallLimit,
      dailyCostUsdLimit: settings.dailyCostUsdLimit,
      dailyCreditLimit: settings.dailyCreditLimit,
      monthlyCreditLimit: settings.monthlyCreditLimit,
      imageMonthlyCreditCap: generation.imageMonthlyCreditCap,
      videoMonthlyCreditCap: generation.videoMonthlyCreditCap,
    };
  },
  sanitize(payload) {
    return { ...payload };
  },
  async hasNonDefault(targetCtx) {
    const settings = await getAiPlatformPropertySettings(
      targetCtx.propertyId,
      targetCtx.organizationId
    );
    const generation = await getMarketingGenerationOverrides(
      targetCtx.propertyId,
      targetCtx.organizationId
    );
    return (
      settings.enabled === false ||
      settings.dailyCallLimit != null ||
      settings.monthlyCallLimit != null ||
      settings.dailyCostUsdLimit != null ||
      generation.imageMonthlyCreditCap != null ||
      generation.videoMonthlyCreditCap != null
    );
  },
  async write(payload, targetCtx, options) {
    const actorUserId = options.actorUserId;
    if (!actorUserId) throw new Error('Missing actor for AI overrides copy');
    await upsertAiPlatformPropertySettings({
      propertyId: targetCtx.propertyId,
      organizationId: targetCtx.organizationId,
      enabled: payload.enabled as boolean | undefined,
      dailyCallLimit: payload.dailyCallLimit as number | null | undefined,
      monthlyCallLimit: payload.monthlyCallLimit as number | null | undefined,
      dailyCostUsdLimit: payload.dailyCostUsdLimit as number | null | undefined,
      dailyCreditLimit: payload.dailyCreditLimit as number | null | undefined,
      monthlyCreditLimit: payload.monthlyCreditLimit as number | null | undefined,
      updatedBy: actorUserId,
    });
    await patchMarketingGenerationOverrides({
      propertyId: targetCtx.propertyId,
      organizationId: targetCtx.organizationId,
      patch: {
        imageMonthlyCreditCap: (payload.imageMonthlyCreditCap as number | null | undefined) ?? null,
        videoMonthlyCreditCap: (payload.videoMonthlyCreditCap as number | null | undefined) ?? null,
      },
      updatedBy: actorUserId,
    });
  },
};

const teamRolesGroup: CloneGroup = {
  id: 'teamRoles',
  label: 'Custom team roles',
  editLeaves: ['team.customRoles:add'],
  planFeature: 'customRoles',
  defaultOn: true,
  async read(sourceCtx) {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('property_custom_roles')
      .select('name, permissions')
      .eq('property_id', sourceCtx.propertyId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).filter((r) => !isSeededTemplateName(String(r.name ?? '')));
    return { roles };
  },
  sanitize(payload) {
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return {
      roles: roles
        .map((r) => {
          const row = r as { name?: string; permissions?: unknown };
          return {
            name: String(row.name ?? '').trim(),
            permissions: normalizePermissionIds(
              Array.isArray(row.permissions) ? (row.permissions as string[]) : []
            ),
          };
        })
        .filter((r) => r.name && !isSeededTemplateName(r.name)),
    };
  },
  async hasNonDefault(targetCtx) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('property_custom_roles')
      .select('name')
      .eq('property_id', targetCtx.propertyId);
    return (data ?? []).some((r) => !isSeededTemplateName(String(r.name ?? '')));
  },
  async write(payload, targetCtx) {
    const supabase = createServiceClient();
    await seedPropertyTeamTemplates(supabase, targetCtx.propertyId);
    const { data: existing } = await supabase
      .from('property_custom_roles')
      .select('name')
      .eq('property_id', targetCtx.propertyId);
    const existingNames = new Set(
      (existing ?? []).map((r) =>
        String(r.name ?? '')
          .trim()
          .toLowerCase()
      )
    );
    const roles = Array.isArray(payload.roles)
      ? (payload.roles as Array<{ name: string; permissions: string[] }>)
      : [];
    for (const role of roles) {
      const key = role.name.trim().toLowerCase();
      if (!key || existingNames.has(key)) continue;
      const { error } = await supabase.from('property_custom_roles').insert({
        property_id: targetCtx.propertyId,
        name: role.name.trim(),
        permissions: role.permissions,
      });
      if (error) {
        // unique collision → skip
        if (error.code === '23505') continue;
        throw new Error(error.message);
      }
      existingNames.add(key);
    }
  },
};

export const PHASE1_CLONE_GROUPS: CloneGroup[] = [
  propertyDetailsGroup,
  settingsKeysGroup({
    id: 'listingContent',
    label: 'Description',
    editLeaves: ['settings.basicInfo:edit'],
    keys: LISTING_CONTENT_KEYS,
    defaultOn: true,
  }),
  settingsKeysGroup({
    id: 'amenities',
    label: 'Amenities',
    editLeaves: ['settings.amenities:edit'],
    keys: AMENITIES_KEYS,
    defaultOn: true,
  }),
  settingsKeysGroup({
    id: 'houseRules',
    label: 'House rules',
    editLeaves: ['settings.houseRules:edit'],
    keys: HOUSE_RULES_KEYS,
    defaultOn: true,
  }),
  settingsKeysGroup({
    id: 'cancellationPolicy',
    label: 'Cancellation policy',
    editLeaves: ['settings.cancellationPolicy:edit'],
    keys: CANCELLATION_KEYS,
    defaultOn: true,
  }),
  guestFormGroup,
  brandingGroup,
  contactGroup,
  emailAutomationsGroup,
  pricingRatesGroup,
  smartPricingGroup,
  voucherConfigGroup,
  publicPagesGroup,
  templatesGroup,
  telegramNotificationsGroup,
  settingsKeysGroup({
    id: 'inboxSnippets',
    label: 'Inbox snippets',
    editLeaves: ['inbox.quickReplies:edit'],
    keys: INBOX_SNIPPET_KEYS,
    defaultOn: true,
  }),
  voiceReceptionistGroup,
  aiOverridesGroup,
  teamRolesGroup,
];

export type { CloneGroup, CloneOptions, ClonePropertyCtx, GroupPayload };
