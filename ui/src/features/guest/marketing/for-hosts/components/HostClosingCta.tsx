import { Link } from 'react-router-dom';

import { ArrowRight, Building2 } from 'lucide-react';

import { MarketingPublicCallout } from '@/features/guest/marketing/shared/components/MarketingPublicCallout';

import { Button } from '@/components/ui/button';
import { captureAppEvent } from '@/lib/posthog/capture';

export function HostClosingCta() {
  return (
    <MarketingPublicCallout
      variant="band"
      icon={Building2}
      title="Ready to run your first property?"
      body={
        <>
          Start free on one listing. See{' '}
          <Link
            to="/for-hosts/pricing"
            className="text-primary font-medium hover:underline"
            onClick={() => captureAppEvent('for_hosts_cta_clicked', { cta: 'pricing_inline' })}
          >
            pricing
          </Link>{' '}
          for what is included, then create your account when you are ready.
        </>
      }
      actions={
        <>
          <Button variant="outline" className="min-h-[44px] rounded-full" asChild>
            <Link
              to="/for-hosts/pricing"
              onClick={() => captureAppEvent('for_hosts_cta_clicked', { cta: 'view_pricing' })}
            >
              View pricing
            </Link>
          </Button>
          <Button
            className="bg-primary-strong hover:bg-primary-strong/90 min-h-[44px] rounded-full text-white"
            asChild
          >
            <Link
              to="/for-hosts/login"
              onClick={() => captureAppEvent('for_hosts_cta_clicked', { cta: 'create_account' })}
            >
              Create account
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </>
      }
    />
  );
}
