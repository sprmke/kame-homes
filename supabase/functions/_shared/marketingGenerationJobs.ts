/**
 * marketing_generation_jobs repository + the DTO the client polls.
 *
 * The claim/complete helpers are compare-and-swap by design: two pollers (or a
 * poller and the cron sweeper) can see the same Veo operation flip to `done` in
 * the same second, and only one of them may download, store, and bill. Every
 * state change that precedes a charge goes through one of these functions.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

import { HOST_FACING_GENERATION_FAILED, toHostFacingError } from './hostFacingError.ts';

export const MARKETING_GENERATION_JOB_COLUMNS = `
  id, organization_id, property_id, media_type, job_status, prompt, negative_prompt,
  model, quality_tier, aspect_ratio, image_size, resolution, duration_seconds,
  reference_paths, reference_urls, provider, provider_operation_name, provider_poll_count,
  last_provider_poll_at, output_storage_path, output_url, output_mime_type, output_bytes,
  output_width, output_height, estimated_credits, credits_consumed, estimated_cost_usd,
  usage_event_id, usage_recorded_at, error_code, error_message, expires_at, completed_at,
  triggered_by, created_at, updated_at
`;

export type MarketingGenerationJobRow = Record<string, unknown>;

export type MarketingGenerationJobDto = {
  id: string;
  organizationId: string;
  propertyId: string;
  mediaType: 'image' | 'video';
  jobStatus: 'pending' | 'processing' | 'finalizing' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  negativePrompt: string | null;
  model: string;
  qualityTier: 'draft' | 'standard' | 'premium';
  aspectRatio: string;
  imageSize: string | null;
  resolution: string | null;
  durationSeconds: number | null;
  referenceUrls: string[];
  referencePaths: string[];
  outputUrl: string | null;
  outputMimeType: string | null;
  outputBytes: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  estimatedCredits: number;
  creditsConsumed: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toMarketingGenerationJobDto(row: MarketingGenerationJobRow) {
  const asNumber = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value);

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    propertyId: String(row.property_id),
    mediaType: row.media_type as MarketingGenerationJobDto['mediaType'],
    jobStatus: row.job_status as MarketingGenerationJobDto['jobStatus'],
    prompt: String(row.prompt ?? ''),
    negativePrompt: (row.negative_prompt as string | null) ?? null,
    model: String(row.model ?? ''),
    qualityTier: row.quality_tier as MarketingGenerationJobDto['qualityTier'],
    aspectRatio: String(row.aspect_ratio ?? ''),
    imageSize: (row.image_size as string | null) ?? null,
    resolution: (row.resolution as string | null) ?? null,
    durationSeconds: asNumber(row.duration_seconds),
    referenceUrls: Array.isArray(row.reference_urls) ? (row.reference_urls as string[]) : [],
    referencePaths: Array.isArray(row.reference_paths) ? (row.reference_paths as string[]) : [],
    outputUrl: (row.output_url as string | null) ?? null,
    outputMimeType: (row.output_mime_type as string | null) ?? null,
    outputBytes: asNumber(row.output_bytes),
    outputWidth: asNumber(row.output_width),
    outputHeight: asNumber(row.output_height),
    estimatedCredits: Number(row.estimated_credits ?? 0),
    creditsConsumed: asNumber(row.credits_consumed),
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  } satisfies MarketingGenerationJobDto;
}

export type InsertMarketingGenerationJobInput = {
  organizationId: string;
  propertyId: string;
  mediaType: 'image' | 'video';
  prompt: string;
  negativePrompt?: string | null;
  model: string;
  qualityTier: string;
  aspectRatio: string;
  imageSize?: string | null;
  resolution?: string | null;
  durationSeconds?: number | null;
  referencePaths: string[];
  referenceUrls: string[];
  estimatedCredits: number;
  estimatedCostUsd: number;
  expiresAt?: string | null;
  triggeredBy: string | null;
};

export async function insertMarketingGenerationJob(
  sb: SupabaseClient,
  input: InsertMarketingGenerationJobInput
): Promise<MarketingGenerationJobRow> {
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .insert({
      organization_id: input.organizationId,
      property_id: input.propertyId,
      media_type: input.mediaType,
      job_status: 'pending',
      prompt: input.prompt,
      negative_prompt: input.negativePrompt ?? null,
      model: input.model,
      quality_tier: input.qualityTier,
      aspect_ratio: input.aspectRatio,
      image_size: input.imageSize ?? null,
      resolution: input.resolution ?? null,
      duration_seconds: input.durationSeconds ?? null,
      reference_paths: input.referencePaths,
      reference_urls: input.referenceUrls,
      estimated_credits: input.estimatedCredits,
      estimated_cost_usd: input.estimatedCostUsd,
      expires_at: input.expiresAt ?? null,
      triggered_by: input.triggeredBy,
    })
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as MarketingGenerationJobRow;
}

/**
 * Video only. Stores the Veo long-running operation name and flips pending -> processing.
 * CAS'd on job_status='pending' so a retried submit (rare — the POST already returns after
 * this) can never double-submit the same row to Google.
 */
export async function markMarketingVideoJobProcessing(
  sb: SupabaseClient,
  jobId: string,
  operationName: string
): Promise<MarketingGenerationJobRow | null> {
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .update({
      job_status: 'processing',
      provider_operation_name: operationName,
      last_provider_poll_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('job_status', 'pending')
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingGenerationJobRow | null) ?? null;
}

/** Video only. Bumps the poll bookkeeping when Google still reports done:false. */
export async function bumpMarketingVideoJobPoll(
  sb: SupabaseClient,
  jobId: string,
  pollCount: number
): Promise<void> {
  const { error } = await sb
    .from('marketing_generation_jobs')
    .update({ provider_poll_count: pollCount, last_provider_poll_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) {
    console.warn('[marketingGenerationJobs] poll bump failed (non-fatal):', error.message);
  }
}

/**
 * Claim a `processing` job for finalize — the first compare-and-swap guarding the
 * double-finalize race. Zero rows back means another poller (or the sweeper) already
 * owns this job; the caller must not download, upload, or bill.
 */
export async function claimMarketingGenerationJobForFinalize(
  sb: SupabaseClient,
  jobId: string,
  claimToken: string
): Promise<MarketingGenerationJobRow | null> {
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .update({
      job_status: 'finalizing',
      finalize_claim_token: claimToken,
      finalize_claimed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('job_status', 'processing')
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingGenerationJobRow | null) ?? null;
}

const SWEEPER_STALE_CLAIM_MINUTES = 2;
const SWEEPER_FINALIZE_BATCH = 25;
const SWEEPER_BILLING_REPAIR_DELAY_MINUTES = 5;
const SWEEPER_REFERENCE_PRUNE_BATCH = 50;
const SWEEPER_REFERENCE_PRUNE_DAYS = 90;

/** Sweeper pass 1 — reclaim `finalizing` rows whose claimant crashed before completing. */
export async function reclaimStaleFinalizingJobs(sb: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - SWEEPER_STALE_CLAIM_MINUTES * 60_000).toISOString();
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .update({ job_status: 'processing', finalize_claim_token: null, finalize_claimed_at: null })
    .eq('job_status', 'finalizing')
    .lt('finalize_claimed_at', cutoff)
    .select('id');
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Sweeper pass 2 candidates — video jobs due for a re-poll, oldest first. */
export async function listMarketingVideoJobsDueForPoll(
  sb: SupabaseClient
): Promise<MarketingGenerationJobRow[]> {
  const cutoff = new Date(Date.now() - 10_000).toISOString();
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .eq('media_type', 'video')
    .eq('job_status', 'processing')
    .not('provider_operation_name', 'is', null)
    .or(`last_provider_poll_at.is.null,last_provider_poll_at.lt.${cutoff}`)
    .order('last_provider_poll_at', { ascending: true, nullsFirst: true })
    .limit(SWEEPER_FINALIZE_BATCH);
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingGenerationJobRow[];
}

/** Sweeper pass 3 — in-flight jobs past their deadline, failed without a charge. */
export async function expireStaleMarketingGenerationJobs(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .update({
      job_status: 'failed',
      error_code: 'timeout',
      error_message: 'This took too long and was stopped.',
      finalize_claim_token: null,
      completed_at: new Date().toISOString(),
    })
    .in('job_status', ['pending', 'processing', 'finalizing'])
    .lt('expires_at', new Date().toISOString())
    .select('id');
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/**
 * Sweeper pass 4 candidates — completed jobs that were never billed. Two shapes match:
 *   - `usage_recorded_at IS NULL` — billing was never even attempted (crash before the
 *     claim).
 *   - `usage_recorded_at` set but `credits_consumed` still null and the claim itself is
 *     older than the repair delay — a claim was taken but `recordAiUsage` never
 *     finished (crashed, threw). Excludes a claim that is merely in flight right now
 *     inside a live request.
 * Either way `credits_consumed IS NULL` is the real "not billed yet" signal —
 * `usage_recorded_at` is only ever a claim timestamp, not a success marker.
 */
export async function listMarketingGenerationJobsNeedingBillingRepair(
  sb: SupabaseClient
): Promise<MarketingGenerationJobRow[]> {
  const cutoff = billingRepairStaleClaimCutoffIso();
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .eq('job_status', 'completed')
    .is('credits_consumed', null)
    .lt('completed_at', cutoff)
    .or(`usage_recorded_at.is.null,usage_recorded_at.lt.${cutoff}`)
    .limit(SWEEPER_FINALIZE_BATCH);
  if (error) throw new Error(error.message);
  return (data ?? []) as MarketingGenerationJobRow[];
}

/** The cutoff `listMarketingGenerationJobsNeedingBillingRepair` used — reuse it for the
 *  matching re-claim so the two windows never drift apart mid-run. */
export function billingRepairStaleClaimCutoffIso(): string {
  return new Date(Date.now() - SWEEPER_BILLING_REPAIR_DELAY_MINUTES * 60_000).toISOString();
}

/** Sweeper pass 5 — prune reference uploads unused for 90 days. */
export async function listStaleGenerationReferences(
  sb: SupabaseClient
): Promise<Array<{ id: string; storage_path: string }>> {
  const cutoff = new Date(
    Date.now() - SWEEPER_REFERENCE_PRUNE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await sb
    .from('marketing_generation_references')
    .select('id, storage_path, last_used_at, created_at')
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  const stale = (data ?? []).filter((row) => {
    const anchor = (row.last_used_at as string | null) ?? (row.created_at as string);
    return anchor < cutoff;
  });
  return stale.slice(0, SWEEPER_REFERENCE_PRUNE_BATCH);
}

export async function deleteGenerationReferences(sb: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await sb.from('marketing_generation_references').delete().in('id', ids);
  if (error) {
    console.warn('[marketingGenerationJobs] reference delete failed (non-fatal):', error.message);
  }
}

export async function getMarketingGenerationJob(
  sb: SupabaseClient,
  jobId: string
): Promise<MarketingGenerationJobRow | null> {
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .eq('id', jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingGenerationJobRow | null) ?? null;
}

export type CompleteMarketingGenerationJobInput = {
  outputStoragePath: string;
  outputUrl: string;
  outputMimeType: string;
  outputBytes: number;
  outputWidth?: number | null;
  outputHeight?: number | null;
  estimatedCostUsd: number;
};

/**
 * Mark a job completed. `fromStatus` is the compare-and-swap guard — pass the status
 * the caller believes it owns. Returns null when the row already moved on, which means
 * another worker owns the finalize and this caller must not bill or upload again.
 */
export async function completeMarketingGenerationJob(
  sb: SupabaseClient,
  jobId: string,
  fromStatus: 'pending' | 'processing' | 'finalizing',
  input: CompleteMarketingGenerationJobInput,
  claimToken?: string | null
): Promise<MarketingGenerationJobRow | null> {
  let query = sb
    .from('marketing_generation_jobs')
    .update({
      job_status: 'completed',
      completed_at: new Date().toISOString(),
      output_storage_path: input.outputStoragePath,
      output_url: input.outputUrl,
      output_mime_type: input.outputMimeType,
      output_bytes: input.outputBytes,
      output_width: input.outputWidth ?? null,
      output_height: input.outputHeight ?? null,
      estimated_cost_usd: input.estimatedCostUsd,
      finalize_claim_token: null,
      error_code: null,
      error_message: null,
    })
    .eq('id', jobId)
    .eq('job_status', fromStatus);

  if (claimToken) query = query.eq('finalize_claim_token', claimToken);

  const { data, error } = await query.select(MARKETING_GENERATION_JOB_COLUMNS).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingGenerationJobRow | null) ?? null;
}

/**
 * Claims the exclusive right to bill one completed job — a compare-and-swap on
 * `usage_recorded_at`, checked and set atomically in one UPDATE. `usage_recorded_at`
 * is therefore a **claim** timestamp, not a success marker; `credits_consumed` (set by
 * `recordMarketingGenerationJobUsage` after `recordAiUsage` actually succeeds) is the
 * real "billing happened" signal — see `listMarketingGenerationJobsNeedingBillingRepair`.
 *
 * This is the thing that makes billing genuinely exactly-once rather than merely
 * "usually once": without it, `recordAiUsage` and this claim are two separate steps,
 * and a crash between them (or the sweeper's billing-repair pass racing the request
 * that just finished) would see nothing recorded, conclude billing never happened,
 * and call `recordAiUsage` a second time — a real double charge, since
 * `ai_platform_usage_events` has no natural per-job dedupe key.
 *
 * Two modes:
 *   - Initial claim (no `staleClaimBeforeIso`): succeeds only if `usage_recorded_at`
 *     has never been set — the normal path, called right after a job completes.
 *   - Repair re-claim (`staleClaimBeforeIso` set): succeeds only if a PRIOR claim is
 *     older than that cutoff AND `credits_consumed` is still null (i.e. the prior
 *     claimant crashed or failed before finishing) — used by the sweeper's billing-
 *     repair pass so a stalled claim is retried rather than permanently un-billable,
 *     while a claim that is still actively in flight (started moments ago, inside a
 *     live request) is never raced.
 *
 * Call this BEFORE `recordAiUsage`, not after. Returns false when another caller
 * already holds (or has already used) the claim.
 */
export async function claimMarketingGenerationJobBilling(
  sb: SupabaseClient,
  jobId: string,
  options?: { staleClaimBeforeIso?: string }
): Promise<boolean> {
  let query = sb
    .from('marketing_generation_jobs')
    .update({ usage_recorded_at: new Date().toISOString() })
    .eq('id', jobId);

  query = options?.staleClaimBeforeIso
    ? query.is('credits_consumed', null).lt('usage_recorded_at', options.staleClaimBeforeIso)
    : query.is('usage_recorded_at', null);

  const { data, error } = await query.select('id').maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Stamps the real credit/usage-event ids after a winning `claimMarketingGenerationJobBilling`. */
export async function recordMarketingGenerationJobUsage(
  sb: SupabaseClient,
  jobId: string,
  input: { creditsConsumed: number; usageEventId?: string | null }
): Promise<void> {
  const { error } = await sb
    .from('marketing_generation_jobs')
    .update({
      credits_consumed: input.creditsConsumed,
      usage_event_id: input.usageEventId ?? null,
    })
    .eq('id', jobId);
  if (error) {
    console.warn('[marketingGenerationJobs] usage stamp failed (non-fatal):', error.message);
  }
}

export async function failMarketingGenerationJob(
  sb: SupabaseClient,
  jobId: string,
  errorCode: string,
  errorMessage: string
): Promise<MarketingGenerationJobRow | null> {
  const { data, error } = await sb
    .from('marketing_generation_jobs')
    .update({
      job_status: 'failed',
      error_code: errorCode,
      error_message: toHostFacingError(errorMessage, HOST_FACING_GENERATION_FAILED).slice(0, 500),
      finalize_claim_token: null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .not('job_status', 'in', '("completed","cancelled")')
    .select(MARKETING_GENERATION_JOB_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarketingGenerationJobRow | null) ?? null;
}

/** Bump last_used_at so the 90-day reference prune leaves in-use assets alone. */
export async function touchGenerationReferences(
  sb: SupabaseClient,
  referenceIds: string[]
): Promise<void> {
  if (referenceIds.length === 0) return;
  const { error } = await sb
    .from('marketing_generation_references')
    .update({ last_used_at: new Date().toISOString() })
    .in('id', referenceIds);
  if (error) {
    console.warn('[marketingGenerationJobs] reference touch failed (non-fatal):', error.message);
  }
}

export const MARKETING_GENERATION_REFERENCE_COLUMNS = `
  id, organization_id, property_id, media_type, storage_path, public_url, mime_type,
  file_name, byte_size, width, height, duration_seconds, last_used_at, created_at
`;

const REFERENCE_LIST_LIMIT = 50;

export async function listMarketingGenerationReferences(
  sb: SupabaseClient,
  propertyId: string
): Promise<Record<string, unknown>[]> {
  const { data, error } = await sb
    .from('marketing_generation_references')
    .select(MARKETING_GENERATION_REFERENCE_COLUMNS)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(REFERENCE_LIST_LIMIT);
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}
