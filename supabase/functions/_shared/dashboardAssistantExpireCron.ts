/**
 * TTL expiry sweep for AI dashboard assistant Tier-2 pending actions — flips stale `pending`
 * rows to `expired` once `expires_at` has passed (15 minutes after proposal, per §4 of
 * docs/workflow/planned/ai-dashboard-assistant.md). Plan's phase 6 hardening item.
 */

import { createServiceClient } from './orgAuth.ts';
import { verifyCronSecret } from './cronSecretGate.ts';

export function verifyDashboardAssistantExpireCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET',
    headerName: 'x-dashboard-assistant-expire-cron-secret',
  });
}

const ASSISTANT_ATTACHMENT_BUCKET = 'ai-assistant-attachments';

function attachmentRetentionDays(): number {
  const raw = Deno.env.get('AI_ASSISTANT_ATTACHMENT_RETENTION_DAYS')?.trim();
  const n = raw ? Number(raw) : 90;
  return Number.isFinite(n) && n > 0 ? n : 90;
}

type ListedObject = { path: string; updatedAt: string | null };

async function listStorageObjects(bucket: string, prefix: string): Promise<ListedObject[]> {
  const supabase = createServiceClient();
  const objects: ListedObject[] = [];
  const stack = [prefix];
  while (stack.length) {
    const current = stack.pop() as string;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(current, { limit: 200, offset, sortBy: { column: 'updated_at', order: 'asc' } });
      if (error) throw error;
      if (!data?.length) break;
      for (const entry of data) {
        const fullPath = current ? `${current}/${entry.name}` : entry.name;
        const size = (entry.metadata as { size?: number } | null)?.size;
        if (typeof size === 'number') {
          objects.push({
            path: fullPath,
            updatedAt: (entry.updated_at as string | null | undefined) ?? null,
          });
        } else {
          stack.push(fullPath);
        }
      }
      if (data.length < 200) break;
      offset += data.length;
    }
  }
  return objects;
}

/** Best-effort purge of assistant attachment objects older than the retention window. */
export async function runAiAssistantAttachmentRetention(): Promise<{ deleted: number }> {
  const supabase = createServiceClient();
  const cutoffMs = Date.now() - attachmentRetentionDays() * 24 * 60 * 60 * 1000;
  let deleted = 0;

  const objects = await listStorageObjects(ASSISTANT_ATTACHMENT_BUCKET, '');
  for (const obj of objects) {
    if (!obj.updatedAt) continue;
    const updatedMs = Date.parse(obj.updatedAt);
    if (!Number.isFinite(updatedMs) || updatedMs >= cutoffMs) continue;
    const { error: removeError } = await supabase.storage
      .from(ASSISTANT_ATTACHMENT_BUCKET)
      .remove([obj.path]);
    if (!removeError) deleted += 1;
  }

  return { deleted };
}

export async function runExpireDashboardAssistantPendingActions(): Promise<
  Record<string, unknown>
> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from('ai_dashboard_assistant_pending_actions')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', nowIso)
    .select('id');

  if (error) {
    throw new Error(`runExpireDashboardAssistantPendingActions: ${error.message}`);
  }

  let attachmentRetention = { deleted: 0 };
  try {
    attachmentRetention = await runAiAssistantAttachmentRetention();
  } catch (retentionErr) {
    console.warn('[dashboard-assistant-expire] attachment retention failed:', retentionErr);
  }

  return {
    expired: expired?.length ?? 0,
    attachmentsDeleted: attachmentRetention.deleted,
  };
}
