/**
 * marketing-media-sweeper — cron housekeeping for the Marketing media library.
 * Trigger: hosted pg_cron + pg_net, every 30 minutes (see
 * docs/archive/operations/scheduled-jobs-and-testing.md).
 * activity-log: N/A — system cleanup of abandoned/expired objects, no host action.
 */

import { verifyMarketingGenerationCronSecret } from '../_shared/marketingGenerationSweeper.ts';
import { runMarketingMediaSweeper } from '../_shared/marketingMediaSweeper.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';

serveCronPost('marketing-media-sweeper', verifyMarketingGenerationCronSecret, () =>
  runMarketingMediaSweeper()
);
