/**
 * contract-expiry-cron — Unit handoff Phase B daily Manila lifecycle.
 * Trigger: hosted pg_cron + pg_net (see supabase/snippets/contract-expiry-cron.sql).
 */

import {
  runContractExpiryCron,
  verifyContractExpiryCronSecret,
} from '../_shared/contractExpiryCron.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('contract-expiry-cron', verifyContractExpiryCronSecret, runContractExpiryCron);
