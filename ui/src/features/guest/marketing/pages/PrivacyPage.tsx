import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import { PLATFORM_APP_NAME, PLATFORM_CONTACT_EMAIL } from '@/lib/platformBranding';

const platformScopeLabel = PLATFORM_APP_NAME ? `${PLATFORM_APP_NAME} ` : '';

export function PrivacyPage() {
  usePageTitle(publicPageTitle('Privacy'));
  return (
    <LegalSimplePage
      title="Privacy Policy"
      description={
        PLATFORM_APP_NAME
          ? `How ${PLATFORM_APP_NAME} collects, uses, and shares personal information for guests, hosts, and team members.`
          : 'How we collect, use, and share personal information for guests, hosts, and team members.'
      }
      sections={[
        {
          title: 'Scope',
          paragraphs: [
            `This policy covers the ${platformScopeLabel}marketing site, guest booking and operational flows, guest portal, and host dashboards. Contact: ${PLATFORM_CONTACT_EMAIL} · Manila, Philippines.`,
            'Property-specific messages or house rules may add stay instructions; they do not replace this policy for how the platform processes data.',
          ],
        },
        {
          title: 'Information we collect',
          paragraphs: [
            'Guest bookings may include names and ages (up to five guests), email, Philippine phone number, address, nationality, stay dates, how you found us, special requests, and optional parking vehicle details (plate, brand, model, color) with related endorsement or receipt files.',
            'Document uploads can include payment receipts, government IDs for adult guests, pet vaccination records and photos, parking papers, and (at security-deposit refund) bank or GCash payout account details. Files are stored in dedicated storage buckets, including private buckets for approved forms and refund receipts.',
            'Hosts and organizations may submit verification materials such as a valid ID, selfie with ID, and ownership or social proof. Account and team data include profile details, roles, and permissions. Technical logs may include device, browser, IP, and usage metadata needed for security and reliability.',
          ],
        },
        {
          title: 'How we use information',
          paragraphs: [
            'We use personal data to fulfill bookings, verify identity and documents, communicate about stays, process security-deposit refunds, operate host dashboards (availability calendar, email, messaging, finance, maintenance, marketing), and meet legal obligations.',
            'AI features (for example receipt or document validation, marketing caption suggestions, inbox reply suggestions, and voice receptionist where enabled) process relevant content to produce suggestions or checks for hosts. We do not sell personal information.',
            'When you start the voice receptionist, microphone audio is sent to Google Gemini for live processing. We do not store raw voice audio. Live captions may be stored as an unverified session transcript.',
          ],
        },
        {
          title: 'Processors and sharing',
          paragraphs: [
            `We share data with service providers that help run ${PLATFORM_APP_NAME || 'the platform'}: Supabase (database, storage, auth, edge functions); Resend (transactional email and inbound document approvals); Google (OAuth sign-in, Maps/Places); Google Gemini and Groq (AI features described above); Meta (guest inbox OAuth/webhooks and marketing publishing where connected); Telegram (internal staff notifications about bookings, not a guest-facing messaging channel); and Jamendo (royalty-free music in the video editor; not used to process guest PII).`,
            'Hosts and authorized team members see guest and booking data needed to operate their properties. We may disclose information when required by law or to protect rights, safety, and the integrity of the service.',
          ],
        },
        {
          title: 'Security and access',
          paragraphs: [
            'Access to operational data is enforced primarily through authenticated edge-function checks (admin, organization, property, parking, and super-admin scopes), not by relying on database row-level security alone. Sensitive integration secrets such as Telegram bot tokens are encrypted at rest.',
            'No method of transmission or storage is perfectly secure. Use strong account credentials and share booking links only with people who need them.',
          ],
        },
        {
          title: 'Retention',
          paragraphs: [
            'We keep booking, document, and account records for as long as needed to operate stays, support hosts, meet accounting or legal requirements, and resolve disputes. When data is no longer required, we delete or anonymize it according to our operational practices.',
            'Voice receptionist captions are kept for 30 days by default. The platform may set a shorter or longer period from 1 to 90 days. You can delete captions from the completed call.',
            'Call timing, outcome, model, and estimated usage remain with account and property records for security, reliability, and billing. Deleting captions also removes their safety flags.',
          ],
        },
        {
          title: 'Analytics and error reporting',
          paragraphs: [
            'When enabled, we use PostHog (first-party analytics) to understand product usage, funnels, and client-side errors. Events use pseudonymous ids and avoid message bodies, government IDs, and payment account details. Host dashboards may include email on the person profile; guest account sessions do not.',
            'We do not sell personal information or use ad-network pixels for retargeting.',
          ],
        },
        {
          title: 'Your rights and choices',
          paragraphs: [
            `Subject to applicable Philippine law, you may request access, correction, or deletion of personal information we hold about you by emailing ${PLATFORM_CONTACT_EMAIL}. We may need to verify your identity and retain certain records when the law requires it.`,
            'Cookie and local-storage practices are described in our Cookie Policy.',
          ],
        },
        {
          title: 'Children',
          paragraphs: [
            'The platform is not directed at children under 13 as account holders. Guest forms may list minors as accompanying guests under an adult’s booking; that information is used only to fulfill the stay.',
          ],
        },
        {
          title: 'Changes',
          paragraphs: [
            'We may update this policy by posting a revised version on this page. Material changes will be dated in the page content when we publish them. ' +
              `Questions: ${PLATFORM_CONTACT_EMAIL}.`,
          ],
        },
      ]}
    />
  );
}
