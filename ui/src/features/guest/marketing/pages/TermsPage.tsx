import { LegalSimplePage } from '@/features/guest/marketing/legal/components/LegalSimplePage';

import { publicPageTitle, usePageTitle } from '@/lib/pageTitle';
import {
  PLATFORM_APP_NAME,
  PLATFORM_CONTACT_EMAIL,
  platformLegalIntro,
  platformLegalSubject,
} from '@/lib/platformBranding';

const legalSubject = platformLegalSubject();

export function TermsPage() {
  usePageTitle(publicPageTitle('Terms'));
  return (
    <LegalSimplePage
      title="Terms of Service"
      description={
        PLATFORM_APP_NAME
          ? `These terms govern your use of ${PLATFORM_APP_NAME} as a guest, host, organization member, or visitor of our public site.`
          : 'These terms govern your use of the platform as a guest, host, organization member, or visitor of our public site.'
      }
      sections={[
        {
          title: 'Who we are',
          paragraphs: [
            platformLegalIntro(),
            'These Terms apply to the marketing site, guest booking flows, guest portal accounts, and host dashboards. Individual properties may publish additional house rules; those rules apply to stays at that property.',
          ],
        },
        {
          title: 'Accounts and eligibility',
          paragraphs: [
            'Hosts and team members must provide accurate account information and keep credentials secure. Guest portal accounts (profile, stays, messages) are separate from host admin access.',
            'Use the platform only for lawful rental, parking, and property-management activities. Do not bypass access controls, scrape private data, or interfere with other users’ stays.',
          ],
        },
        {
          title: 'Bookings and property rules',
          paragraphs: [
            'Submitting a guest form creates a booking request subject to host review. Availability, rates, fees, cancellation, pets, parking, and document requirements are set by the property or organization and may appear in the form, emails, or stay materials.',
            'Hosts are responsible for listing accuracy, local compliance (including tax and safety rules), guest communication, and decisions on approvals, cancellations, and refunds within the tools we provide.',
          ],
        },
        {
          title: 'Payments, deposits, and refunds',
          paragraphs: [
            'Payment proof, security deposits, and refund timing follow the property’s instructions and the booking workflow, including document review, check-in, check-out, and security-deposit refund steps when enabled.',
            `${legalSubject} provides software to collect information and run that workflow. We do not guarantee occupancy, payment-processor uptime, or that every third-party transfer will succeed on first attempt.`,
          ],
        },
        {
          title: 'Reviews',
          paragraphs: [
            'After check-out, guests and hosts may review each other during a 14-day window. Reviews stay hidden until both sides submit or the window closes. Do not offer money, refunds, discounts, or other value in exchange for a review or a rating.',
            'Public review text and responses may not include phone numbers, emails, or URLs. Each side may post one public response. Either side may report a published review. Super-admin decides removals. Hosts may use published guest-reputation summaries when screening a booking from that guest.',
          ],
        },
        {
          title: 'Acceptable use',
          paragraphs: [
            'Do not upload fraudulent IDs, receipts, or documents; harass others; or use messaging and marketing tools for spam or illegal content.',
            'We may suspend access when we reasonably believe these Terms, property rules, or applicable law have been violated.',
          ],
        },
        {
          title: 'Platform availability and third parties',
          paragraphs: [
            'The service depends on infrastructure and integrations (for example hosting, email, maps, messaging, and AI helpers). Features may change, and temporary outages can occur.',
            'Links to third-party sites or apps are provided for convenience; their terms and privacy practices apply separately.',
          ],
        },
        {
          title: 'Limitation of liability',
          paragraphs: [
            `To the fullest extent permitted by Philippine law, ${legalSubject} is provided on an as-is and as-available basis. We are not liable for indirect, incidental, special, or consequential damages arising from use of the platform, including disputes between guests and hosts over stays, deposits, or property conditions.`,
            'Nothing in these Terms limits liability that cannot be limited under applicable law.',
          ],
        },
        {
          title: 'Governing law and changes',
          paragraphs: [
            'These Terms are governed by the laws of the Republic of the Philippines. Courts in Metro Manila have exclusive jurisdiction, subject to mandatory consumer protections that cannot be waived.',
            `We may update these Terms by posting a revised version on this page. Continued use after changes take effect constitutes acceptance. Questions: ${PLATFORM_CONTACT_EMAIL}.`,
          ],
        },
      ]}
    />
  );
}
