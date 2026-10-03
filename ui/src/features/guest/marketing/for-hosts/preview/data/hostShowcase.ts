import {
  Banknote,
  Bell,
  Bot,
  CalendarClock,
  Globe,
  Inbox,
  LayoutGrid,
  Megaphone,
  PhoneCall,
  Sparkles,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { HOST_TOUR_FEATURE_COUNT } from '@/features/guest/marketing/for-hosts/data/hostTourChapters';

/**
 * All copy and demo data for the ground-up `/for-hosts/preview` redesign lives here so the
 * words can be reviewed in one place. Every section component reads from this file.
 */

/* ---------------------------------------------------------------- *
 * Hero
 * ---------------------------------------------------------------- */

export const heroContent = {
  eyebrow: 'For property hosts',
  /** Rendered as masked lines; the last word carries the teal accent. */
  headline: ['Every stay,', 'start to finish,', 'on one dashboard.'],
  lead: 'Kame Homes replaces the spreadsheet, the Airbnb tab, the Messenger threads, and the receipt folder with one workflow, and keeps it moving while you are away from your desk.',
  primaryCta: { label: 'Start free', to: '/for-hosts/login' },
  secondaryCta: { label: 'Watch the tour', sectionId: 'features' },
  trustLine: 'No card to start · Works on your phone · Cancel anytime',
} as const;

/* ---------------------------------------------------------------- *
 * Proof line
 * ---------------------------------------------------------------- */

export const proofContent = {
  statement:
    'The same six-stage workflow runs on every booking, whether it came from your website, Airbnb, or a walk-in.',
  integrations: [
    { label: 'Two-way Airbnb sync', icon: CalendarClock },
    { label: 'Facebook & Instagram inbox', icon: Inbox },
    { label: 'AI receipt checks', icon: Sparkles },
  ] as { label: string; icon: LucideIcon }[],
} as const;

/* ---------------------------------------------------------------- *
 * Workflow spine — the signature animated rail
 * ---------------------------------------------------------------- */

export interface WorkflowStage {
  status: string;
  label: string;
  handled: string;
  /** The one stage that carries the sample "needs you" marker in the demo. */
  needsYou?: boolean;
}

export const workflowContent = {
  eyebrow: 'The workflow',
  title: 'One booking. One path. Nothing slips.',
  lead: 'Direct, Airbnb, or walk-in, every booking runs the same six stages. The teal line is the part Kame handles on its own. You step in only where a stage needs a decision.',
  stages: [
    {
      status: 'Pending review',
      label: 'New booking',
      handled: 'Guest submits the form. Dates, IDs, and payment proof land on one card.',
    },
    {
      status: 'Pending documents',
      label: 'Documents',
      handled: 'GAF and pet approvals clear by email and file themselves back to the booking.',
      needsYou: true,
    },
    {
      status: 'Ready for check-in',
      label: 'Ready to check in',
      handled:
        'AI checks the deposit receipt, the calendar and Airbnb update, the stay guide sends.',
    },
    {
      status: 'Ready for check-out',
      label: 'Staying',
      handled: 'Mid-stay messages, extensions, and issues stay attached to the same booking.',
    },
    {
      status: 'Pending SD refund',
      label: 'Deposit refund',
      handled: 'A scheduled reminder makes sure the security deposit goes back on time.',
    },
    {
      status: 'Completed',
      label: 'Closed',
      handled: 'Income posts to finance, the stay is archived, the unit reopens for sale.',
    },
  ] as WorkflowStage[],
} as const;

/* ---------------------------------------------------------------- *
 * Feature showcase — sticky scroll
 * ---------------------------------------------------------------- */

export type ShowcaseDemoId = 'bookings' | 'calendar' | 'inbox' | 'money' | 'marketing' | 'team';

export interface ShowcaseStory {
  id: ShowcaseDemoId;
  /** Short tab / rail label. */
  kicker: string;
  title: string;
  body: string;
  /** Named tools folded into this group, shown as chips under the copy. */
  includes: { label: string; icon: LucideIcon }[];
}

export const showcaseContent = {
  eyebrow: 'Inside the dashboard',
  title: 'The work of an operations team, grouped into six areas',
  lead: 'Scroll through what each area does. Every screen here is the real thing, not a diagram.',
  tourLink: {
    label: `See all ${HOST_TOUR_FEATURE_COUNT} features in the full tour`,
    sectionId: 'features',
  },
  stories: [
    {
      id: 'bookings',
      kicker: 'Bookings',
      title: 'Move every stay forward without loose ends',
      body: 'Work bookings on a board you drag between stages, or add a walk-in by hand. Documents, receipt checks, and guest emails follow the pipeline on their own.',
      includes: [
        { label: 'Booking workflow', icon: LayoutGrid },
        { label: 'Drag board', icon: LayoutGrid },
        { label: 'AI spreadsheet import', icon: Sparkles },
      ],
    },
    {
      id: 'calendar',
      kicker: 'Calendar & pricing',
      title: 'Set rates right on the calendar, synced with Airbnb',
      body: 'Weekday, weekend, and date-specific rates with booked and blocked nights in view. Airbnb reservations flow in to review; your nights flow back out.',
      includes: [
        { label: 'Nightly pricing', icon: Tags },
        { label: 'Two-way Airbnb sync', icon: CalendarClock },
      ],
    },
    {
      id: 'inbox',
      kicker: 'Guest inbox',
      title: 'AI drafts the reply, or answers on its own',
      body: 'Website chat, Facebook, and Instagram land in one thread. Review the AI-drafted reply and send, or let it respond automatically. Guests can also hold a live voice call with Kame.',
      includes: [
        { label: 'Unified inbox', icon: Inbox },
        { label: 'AI voice receptionist', icon: PhoneCall },
      ],
    },
    {
      id: 'money',
      kicker: 'Money',
      title: 'Know what each stay actually earns',
      body: 'Booking income posts automatically. Add expenses, follow net profit per property, and export an owner-ready PDF. Recurring upkeep runs on a schedule beside it.',
      includes: [
        { label: 'Finance & reporting', icon: Banknote },
        { label: 'Maintenance', icon: Wrench },
      ],
    },
    {
      id: 'marketing',
      kicker: 'Marketing & pages',
      title: 'Fill the calendar without hiring a marketing team',
      body: 'Build a month of posts, graphics, and reels in the Content Studio, then publish to Facebook and Instagram. Edit your public listing and stay guide with a live preview.',
      includes: [
        { label: 'Marketing Content Studio', icon: Megaphone },
        { label: 'Public Pages editor', icon: Globe },
      ],
    },
    {
      id: 'team',
      kicker: 'Team & control',
      title: 'Bring people in with exactly the right access',
      body: 'Invite teammates as Full Access, Operations, Read Only, or a custom role. Route chat, finance, and maintenance alerts to the right group, and ask the dashboard anything.',
      includes: [
        { label: 'Team & roles', icon: Users },
        { label: 'Telegram alerts', icon: Bell },
        { label: 'AI assistant', icon: Bot },
      ],
    },
  ] as ShowcaseStory[],
} as const;

/* ---------------------------------------------------------------- *
 * Setup steps
 * ---------------------------------------------------------------- */

export interface SetupStep {
  step: string;
  title: string;
  body: string;
}

export const setupContent = {
  eyebrow: 'How it works',
  title: 'Four moves, then it runs on its own',
  lead: 'Setup is front-loaded on purpose. Do these once and new bookings take care of themselves.',
  steps: [
    {
      step: '01',
      title: 'Bring your properties in',
      body: 'Add a listing by hand, or upload your booking history and let AI map the columns.',
    },
    {
      step: '02',
      title: 'Configure once',
      body: 'Forms, nightly rates, deposit rules, and message templates. Set them and leave them.',
    },
    {
      step: '03',
      title: 'Connect your channels',
      body: 'Two-way Airbnb sync, the Facebook and Instagram inbox, and Telegram alerts for your team.',
    },
    {
      step: '04',
      title: 'Let it run',
      body: 'Every new booking follows the workflow on its own. You step in only when it asks.',
    },
  ] as SetupStep[],
} as const;

/* ---------------------------------------------------------------- *
 * Closing CTA
 * ---------------------------------------------------------------- */

export const closingContent = {
  eyebrow: 'Get started',
  title: 'Start free on your first listing.',
  body: 'Add one property, run a real booking through the workflow, and see where it gives you time back. Upgrade when you are ready.',
  primaryCta: { label: 'Create account', to: '/for-hosts/login' },
  secondaryCta: { label: 'View pricing', to: '/for-hosts/pricing' },
  trustLine: 'No card to start · Your whole organization on one bill · Cancel anytime',
} as const;
