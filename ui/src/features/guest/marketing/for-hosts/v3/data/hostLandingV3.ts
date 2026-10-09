import {
  Bell,
  Bot,
  CalendarClock,
  FileSpreadsheet,
  KeyRound,
  LayoutGrid,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Copy and sample data for the `/for-hosts/v3` landing page. Every section reads from here so
 * the words can be reviewed in one place. Guest names and amounts are sample data.
 */

export const V3_SIGNUP_CTA = { label: 'Start free', to: '/for-hosts/login' } as const;
export const V3_PRICING_CTA = { label: 'View pricing', to: '/for-hosts/pricing' } as const;

/** Real property photography already used across the marketing site. */
export const v3Images = {
  hero: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&q=80',
  marketing: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80',
  closing: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1800&q=80',
} as const;

/* ---------------------------------------------------------------- *
 * Hero
 * ---------------------------------------------------------------- */

export const v3Hero = {
  headline: ['Every stay, handled', 'from one place.'],
  lead: 'Bookings, guest messages, pricing, and finances in one workflow that keeps moving while you are away.',
  secondaryCta: { label: 'Watch the tour', sectionId: 'tour' },
  imageAlt: 'Bright serviced apartment living room ready for the next guest',
} as const;

/** Statuses the hero booking card cycles through. Labels match the dashboard workflow. */
export const v3HeroStatuses = [
  { label: 'Pending review', note: 'Form and payment proof received', tone: 'neutral' },
  { label: 'Pending documents', note: 'GAF approval cleared by email', tone: 'amber' },
  { label: 'Ready for check-in', note: 'Stay guide sent to guest', tone: 'teal' },
  { label: 'Completed', note: '₱12,897 posted to finance', tone: 'green' },
] as const;

/* ---------------------------------------------------------------- *
 * Replace statement
 * ---------------------------------------------------------------- */

export const v3Replace = {
  intro: 'Right now a booking lives in',
  tools: ['a spreadsheet,', 'the Airbnb tab,', 'three Messenger threads,', 'and a receipt folder.'],
  outro: 'Kame Homes puts it on one card.',
} as const;

/* ---------------------------------------------------------------- *
 * Pinned workflow
 * ---------------------------------------------------------------- */

export interface V3WorkflowStage {
  status: string;
  title: string;
  body: string;
  /** Activity line the sample booking gains when it reaches this stage. */
  log: string;
  needsYou?: boolean;
}

export const v3Workflow = {
  eyebrow: 'How it works',
  title: 'One booking, six stages, nothing slips',
  lead: 'Direct, Airbnb, or walk-in, every booking runs the same path. You only step in when a stage asks.',
  sampleGuest: { name: 'Bea Villareal', stay: 'Nov 14 to 17', unit: 'Unit 12F, 1BR' },
  stages: [
    {
      status: 'Pending review',
      title: 'New booking',
      body: 'The guest form lands with dates, IDs, and payment proof on one card.',
      log: 'Booking form received',
    },
    {
      status: 'Pending documents',
      title: 'Documents',
      body: 'GAF and pet approvals clear by email and file themselves back to the booking.',
      log: 'GAF approved by building admin',
      needsYou: true,
    },
    {
      status: 'Ready for check-in',
      title: 'Ready to check in',
      body: 'AI checks the deposit receipt, the calendar and Airbnb update, the stay guide goes out.',
      log: 'Receipt verified, stay guide sent',
    },
    {
      status: 'Ready for check-out',
      title: 'Staying',
      body: 'Messages, extensions, and issues stay attached to the same booking.',
      log: 'Late check-out request answered',
    },
    {
      status: 'Pending SD refund',
      title: 'Deposit refund',
      body: 'A scheduled reminder makes sure the security deposit goes back on time.',
      log: 'Deposit refund reminder sent',
    },
    {
      status: 'Completed',
      title: 'Closed',
      body: 'Income posts to finance and the unit opens up for the next guest.',
      log: 'Income posted to finance',
    },
  ] as V3WorkflowStage[],
} as const;

/* ---------------------------------------------------------------- *
 * Feature bento
 * ---------------------------------------------------------------- */

export const v3Features = {
  title: 'Everything a host team does, in one dashboard',
  bookings: {
    title: 'A board for every stay',
    body: 'Drag bookings between stages or add a walk-in. Documents, receipt checks, and emails follow on their own.',
  },
  receptionist: {
    title: 'A receptionist that never sleeps',
    body: 'Website chat, Facebook, and Instagram in one inbox. AI drafts the reply or answers on its own, and guests can call Kame by voice.',
    question: 'Is early check-in possible on the 14th?',
    answer: 'Yes, from 12 PM for that date. Want me to add it to your booking?',
  },
  pricing: {
    title: 'Rates on the calendar',
    body: 'Weekday, weekend, and date rates, synced both ways with Airbnb.',
    rates: [
      { label: 'Weekday', value: '₱3,499' },
      { label: 'Weekend', value: '₱4,299' },
      { label: 'Holiday', value: '₱5,200' },
    ],
  },
  money: {
    title: 'Know what each stay earns',
    body: 'Income posts itself. Add expenses and export an owner-ready PDF.',
    kpiLabel: 'Net this month',
    kpiValue: '₱86,240',
    points: [22, 30, 26, 41, 38, 52, 47, 61, 58, 72, 69, 84],
  },
  marketing: {
    title: 'Posts that fill the calendar',
    body: 'Plan a month of posts and reels, then publish to Facebook and Instagram.',
    imageAlt: 'Sunlit bedroom used in a sample Instagram post',
    caption: 'Weekend open at Unit 12F. Book direct and save.',
  },
  team: {
    title: 'The right access for every teammate',
    body: 'Invite people with a built-in or custom role, route alerts to Telegram, and ask the AI assistant anything about your numbers.',
    chips: [
      { label: 'Full Access', icon: KeyRound },
      { label: 'Operations', icon: LayoutGrid },
      { label: 'Read Only', icon: ShieldCheck },
      { label: 'Custom roles', icon: Users },
      { label: 'Telegram alerts', icon: Bell },
      { label: 'AI assistant', icon: Bot },
    ] as { label: string; icon: LucideIcon }[],
  },
} as const;

/* ---------------------------------------------------------------- *
 * Tour, setup, FAQ, closing
 * ---------------------------------------------------------------- */

export const v3Tour = {
  title: 'See the whole thing in three minutes',
  lead: 'A narrated walk through the dashboard. Jump to any part.',
} as const;

export interface V3SetupStep {
  title: string;
  body: string;
  icon: LucideIcon;
}

export const v3Setup = {
  title: 'Set it up once. Then it runs.',
  steps: [
    {
      title: 'Add your units',
      body: 'Create a listing by hand, or upload your booking sheet and let AI map the columns.',
      icon: FileSpreadsheet,
    },
    {
      title: 'Set your rules',
      body: 'Forms, nightly rates, deposit rules, and message templates.',
      icon: Sparkles,
    },
    {
      title: 'Connect channels',
      body: 'Airbnb sync, the Facebook and Instagram inbox, and Telegram alerts.',
      icon: PlugZap,
    },
    {
      title: 'Let it run',
      body: 'New bookings follow the workflow. You step in when one asks.',
      icon: CalendarClock,
    },
  ] as V3SetupStep[],
} as const;

export const v3Faq = {
  eyebrow: 'Questions',
  title: 'Before you sign up',
  contact: { label: 'Ask us anything', to: '/contact' },
  items: [
    {
      question: 'Do I need a card to start?',
      answer:
        'No. Create an account, add a property, and run real bookings before you pick a plan.',
    },
    {
      question: 'Does it work with Airbnb?',
      answer:
        'Yes. Calendar sync runs both ways: Airbnb reservations come in for review, and your booked and blocked nights go back out.',
    },
    {
      question: 'Can I bring my existing bookings?',
      answer:
        'Yes. Upload your booking spreadsheet and AI maps the columns for you. You review before anything is saved.',
    },
    {
      question: 'Can my team use it?',
      answer:
        'Invite teammates as Full Access, Operations, Read Only, or a custom role, per organization or per property.',
    },
    {
      question: 'Does it work on my phone?',
      answer:
        'The full dashboard works on your phone, and you can install it to your home screen like an app.',
    },
    {
      question: 'How does billing work?',
      answer: 'Your whole organization is on one bill. Upgrade, downgrade, or cancel anytime.',
    },
  ],
} as const;

export const v3Closing = {
  title: 'Run your next booking on Kame Homes.',
  body: 'Start free on one property and see where it gives you time back.',
  imageAlt: 'Modern vacation home exterior at dusk',
} as const;
