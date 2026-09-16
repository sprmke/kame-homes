/**
 * parking-settings — Admin GET/PATCH for per-parking operator config.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  buildParkingIntegrationStatus,
  buildPlatformSecretsStatus,
} from '../_shared/propertyIntegrationStatus.ts';
import { ensureParkingSettings } from '../_shared/parkingSettingsSeed.ts';
import {
  mergeParkingAutomationToggles,
  parseParkingAutomationTogglesPatch,
} from '../_shared/parkingAutomationToggles.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  computePaymentSettingsFingerprint,
  extractPaymentMethodsFromPatchBody,
  patchBodyTouchesPaymentSettings,
  requireSettingsVerificationToken,
} from '../_shared/settingsVerification.ts';
import { notifyParkingPaymentSettingsChanged } from '../_shared/settingsChangeNotifyEmail.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

function serializeParkingSettingsRow(
  row: Record<string, unknown>,
  extras?: {
    parkingIntegrations?: Awaited<ReturnType<typeof buildParkingIntegrationStatus>>;
    platformSecrets?: ReturnType<typeof buildPlatformSecretsStatus>;
  }
) {
  return {
    parkingId: row.parking_id,
    paymentProvider: row.payment_provider ?? null,
    gcashName: row.gcash_name ?? null,
    gcashNumber: row.gcash_number ?? null,
    gcashQrImageUrl: row.gcash_qr_image_url ?? null,
    paymentMethods: row.payment_methods ?? [],
    parkingNotificationTemplates: row.parking_notification_templates ?? {},
    automationToggles: mergeParkingAutomationToggles(row.automation_toggles),
    updatedAt: row.updated_at,
    parkingIntegrations: extras?.parkingIntegrations,
    platformSecrets: extras?.platformSecrets,
  };
}

serveAuthenticated('parking-settings', async (req, user) => {
  const permission = req.method === 'GET' ? 'org.parkings:view' : 'org.parkings:manage';
  const access = await resolveScopedParkingAccess(req, permission);
  const { parkingRow, org } = access;
  const parkingId = parkingRow.id;
  const supabase = createServiceClient();

  if (req.method === 'GET') {
    await ensureParkingSettings(parkingId);
    const { data, error } = await supabase
      .from('parking_settings')
      .select('*')
      .eq('parking_id', parkingId)
      .maybeSingle();
    if (error || !data) {
      return jsonError(req, 'Failed to load parking settings', 500);
    }
    return jsonSuccess(
      req,
      serializeParkingSettingsRow(data as Record<string, unknown>, {
        parkingIntegrations: await buildParkingIntegrationStatus(parkingId),
        platformSecrets: buildPlatformSecretsStatus(),
      })
    );
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const body = await readJsonBody(req);
    let paymentSettingsChanged = false;

    if (patchBodyTouchesPaymentSettings(body)) {
      const methods = extractPaymentMethodsFromPatchBody(body);
      if (!methods) {
        return jsonError(req, 'paymentMethods is required when updating payment settings');
      }
      const patchFingerprint = await computePaymentSettingsFingerprint(methods);
      const token =
        typeof body.settingsVerificationToken === 'string' ? body.settingsVerificationToken : '';
      try {
        await requireSettingsVerificationToken({
          token,
          organizationId: org.id,
          parkingId: parkingRow.id as string,
          patchFingerprint,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Verification required';
        return jsonError(req, msg, 403);
      }
      paymentSettingsChanged = true;
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (typeof body.gcashName === 'string') patch.gcash_name = body.gcashName.trim() || null;
    if (typeof body.gcashNumber === 'string') patch.gcash_number = body.gcashNumber.trim() || null;
    if (typeof body.gcashQrImageUrl === 'string') {
      patch.gcash_qr_image_url = body.gcashQrImageUrl.trim() || null;
    }
    if (typeof body.paymentProvider === 'string') {
      patch.payment_provider = body.paymentProvider.trim() || null;
    }
    if (Array.isArray(body.paymentMethods)) {
      patch.payment_methods = body.paymentMethods;
      const methods = body.paymentMethods as Array<{
        isPrimary?: boolean;
        qrImageUrl?: string | null;
        provider?: string;
        accountName?: string;
        accountNumber?: string;
      }>;
      const primary = methods.find((m) => m.isPrimary === true) ?? methods[0];
      if (primary) {
        if (typeof primary.qrImageUrl === 'string') {
          patch.gcash_qr_image_url = primary.qrImageUrl.trim() || null;
        }
        if (typeof primary.provider === 'string' && !body.paymentProvider) {
          patch.payment_provider = primary.provider.trim() || null;
        }
        if (typeof primary.accountName === 'string' && body.gcashName === undefined) {
          patch.gcash_name = primary.accountName.trim() || null;
        }
        if (typeof primary.accountNumber === 'string' && body.gcashNumber === undefined) {
          patch.gcash_number = primary.accountNumber.trim() || null;
        }
      }
    }
    if (
      body.parkingNotificationTemplates &&
      typeof body.parkingNotificationTemplates === 'object'
    ) {
      patch.parking_notification_templates = body.parkingNotificationTemplates;
    }

    const automationPatch = parseParkingAutomationTogglesPatch(body.automationToggles);
    if (automationPatch) {
      const { data: existingRow } = await supabase
        .from('parking_settings')
        .select('automation_toggles')
        .eq('parking_id', parkingId)
        .maybeSingle();
      const merged = {
        ...mergeParkingAutomationToggles(existingRow?.automation_toggles),
        ...automationPatch,
      };
      patch.automation_toggles = merged;
    }

    if (Object.keys(patch).length <= 1) {
      return jsonError(req, 'No valid fields to update');
    }

    await ensureParkingSettings(parkingId);
    const { data, error } = await supabase
      .from('parking_settings')
      .update(patch)
      .eq('parking_id', parkingId)
      .select('*')
      .single();

    if (error) {
      console.error('[parking-settings]', error.message);
      return jsonError(req, 'Failed to update parking settings', 500);
    }

    if (paymentSettingsChanged) {
      notifyParkingPaymentSettingsChanged({
        supabase,
        organizationId: org.id,
        parkingId: parkingRow.id as string,
        ownerId: org.owner_id,
        parkingName: parkingRow.name as string,
        actorUserId: user.id,
      }).catch((err) => {
        console.error('[parking-settings] settings change notify failed', err);
      });
    }

    const changedFields = Object.keys(patch).filter((k) => k !== 'updated_at');
    await logAssetActivity({
      req,
      user,
      action: 'settings.updated',
      parkingId,
      organizationId: org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetType: 'settings',
      targetId: parkingId,
      targetLabel: parkingRow.name as string,
      metadata: {
        area: paymentSettingsChanged
          ? 'payment'
          : patch.automation_toggles !== undefined
            ? 'automation_toggles'
            : patch.parking_notification_templates !== undefined
              ? 'notification_templates'
              : 'general',
        fields: changedFields,
        payment_otp_verified: paymentSettingsChanged,
      },
    });

    return jsonSuccess(req, serializeParkingSettingsRow(data as Record<string, unknown>));
  }

  return jsonError(req, `Method ${req.method} not allowed`, 405);
});
