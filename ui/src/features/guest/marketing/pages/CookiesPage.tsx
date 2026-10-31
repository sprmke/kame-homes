import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { PLATFORM_APP_NAME, PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';

export function CookiesPage() {
  usePageTitle(publicPageTitle('Cookies'));
  return (
    <LegalSimplePage
      title="Cookie Policy"
      description={
        PLATFORM_APP_NAME
          ? `How ${PLATFORM_APP_NAME} uses cookies and similar browser storage on the marketing site, guest flows, and dashboards.`
          : 'How we use cookies and similar browser storage on the marketing site, guest flows, and dashboards.'
      }
      sections={[
        {
          title: 'Overview',
          paragraphs: [
            PLATFORM_APP_NAME
              ? `${PLATFORM_APP_NAME} uses browser storage for sign-in sessions, preferences, and first-party product analytics (PostHog) when enabled. We do not load advertising pixels or third-party ad trackers on marketing or guest booking surfaces.`
              : 'We use browser storage for sign-in sessions, preferences, and first-party product analytics (PostHog) when enabled. We do not load advertising pixels or third-party ad trackers on marketing or guest booking surfaces.',
            `Contact: ${PLATFORM_CONTACT_EMAIL}. See also our Privacy Policy and Terms of Service.`,
          ],
        },
        {
          title: 'What we store',
          paragraphs: [
            'When you sign in (host dashboard or guest portal), Supabase Auth stores a session in the browser (typically local storage or cookies managed by the auth client) so you stay logged in across page loads.',
            'We may also store UI preferences such as theme (light/dark) locally. When analytics is enabled, PostHog may set first-party cookies or local storage to measure product usage and errors. Session replay stays off unless we explicitly enable it with input masking.',
            'Mode-switch and similar client state may use in-memory or local storage for navigation between guest and host marketing modes.',
          ],
        },
        {
          title: 'Why we use them',
          paragraphs: [
            'Session storage is required for authenticated features (dashboards, guest portal, team invites). Preference storage improves usability and is not used to track you across unrelated third-party sites.',
          ],
        },
        {
          title: 'Third parties',
          paragraphs: [
            'Embedded or linked third-party services (for example Google Maps, Meta, or OAuth providers) may set their own cookies when you interact with those flows. Their policies apply to that activity.',
            'We do not operate a separate advertising pixel network on these pages.',
          ],
        },
        {
          title: 'Your controls',
          paragraphs: [
            'You can clear site data or block cookies in your browser settings. Blocking authentication storage will prevent sign-in and signed-in features from working.',
            `For privacy questions beyond cookies, see the Privacy Policy or email ${PLATFORM_CONTACT_EMAIL}.`,
          ],
        },
      ]}
    />
  );
}
