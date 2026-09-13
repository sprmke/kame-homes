/**
 * marketing-generation-sweeper — cron sweep for in-flight AI video generation jobs.
 * Trigger: hosted pg_cron + pg_net, every minute (see
 * docs/archive/operations/scheduled-jobs-and-testing.md).
 */

import {
  runMarketingGenerationSweeper,
  verifyMarketingGenerationCronSecret,
} from '../_shared/marketingGenerationSweeper.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost(
  'marketing-generation-sweeper',
  verifyMarketingGenerationCronSecret,
  runMarketingGenerationSweeper
);
