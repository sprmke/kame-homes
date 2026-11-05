/**
 * ops-report — super-admin access to weekly operations reports.
 *
 * GET  ?limit=20                 list recent reports
 * GET  ?id=<uuid>                one report (summary + markdown)
 * GET  ?id=<uuid>&format=markdown  Markdown download
 * POST { action: 'generate' }    generate/update the current week
 * POST { action: 'send', reportId, force? }  send the email once
 *
 * Plan: docs/workflow/in-progress/weekly-ops-report.md
 */
import { corsHeaders } from '../_shared/cors.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { generateOpsReport, sendOpsReportEmail } from '../_shared/opsReportRunner.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_COLUMNS =
  'id,period_kind,period_start,period_end,overall_status,counts,generated_at,email_sent_at,email_error';

serveSuperAdmin('ops-report', async (req, user) => {
  const supabase = createServiceClient();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const id = url.searchParams.get('id')?.trim();
    if (id) {
      if (!UUID_RE.test(id)) return jsonError(req, 'Invalid report id', 400);
      const { data, error } = await supabase.from('ops_reports').select('*').eq('id', id).maybeSingle();
      if (error) return jsonError(req, error.message, 500);
      if (!data) return jsonError(req, 'Report not found', 404);

      if (url.searchParams.get('format') === 'markdown') {
        const stamp = String(data.period_start).slice(0, 10);
        return new Response(String(data.markdown ?? ''), {
          headers: {
            ...corsHeaders(req),
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename="ops-report-${stamp}.md"`,
            'Cache-Control': 'private, no-store',
          },
        });
      }
      return jsonSuccess(req, { report: data });
    }

    const limitRaw = Number(url.searchParams.get('limit') ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50) : 20;
    const { data, error } = await supabase
      .from('ops_reports')
      .select(LIST_COLUMNS)
      .order('generated_at', { ascending: false })
      .limit(limit);
    if (error) return jsonError(req, error.message, 500);
    return jsonSuccess(req, { reports: data ?? [] });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.action === 'generate') {
      try {
        const report = await generateOpsReport({ periodKind: 'manual', generatedBy: 'manual' });
        await logSuperAdminAction(user, {
          action: 'ops_report.generate',
          targetType: 'ops_report',
          targetId: report.id,
          summary: `Generated operations report for ${report.period_start} to ${report.period_end}`,
          metadata: {
            periodKind: report.period_kind,
            overallStatus: report.overall_status,
            counts: report.counts,
          },
        });
        return jsonSuccess(req, { report });
      } catch (error) {
        return jsonError(req, error instanceof Error ? error.message : 'generate failed', 500);
      }
    }

    if (body.action === 'send') {
      const reportId = typeof body.reportId === 'string' ? body.reportId.trim() : '';
      if (!UUID_RE.test(reportId)) return jsonError(req, 'Invalid reportId', 400);
      const result = await sendOpsReportEmail({
        reportId,
        force: body.force === true,
      });
      await logSuperAdminAction(user, {
        action: 'ops_report.send',
        targetType: 'ops_report',
        targetId: reportId,
        summary: result.sent
          ? `Sent operations report to ${result.recipients?.length ?? 0} recipient(s)`
          : `Operations report email not sent (${result.reason ?? 'unknown'})`,
        metadata: {
          sent: result.sent,
          reason: result.reason ?? null,
          recipientCount: result.recipients?.length ?? 0,
        },
      });
      return jsonResponse(req, { success: true, data: result }, result.sent ? 200 : 202);
    }

    return jsonError(req, 'Unknown action', 400);
  }

  return jsonError(req, 'Method not allowed', 405);
});
