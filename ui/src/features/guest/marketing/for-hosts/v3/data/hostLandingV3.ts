import {
  Activity,
  BadgeCheck,
  Bell,
  Bot,
  CalendarClock,
  Car,
  Copy,
  FileSpreadsheet,
  Mail,
  PlugZap,
  Receipt,
  Smartphone,
  SlidersHorizontal,
  Ticket,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Copy and sample data for the `/for-hosts/v3` landing page. Every section reads from here so
 * the words can be reviewed in one place. Guest names and amounts are sample data.
 */

export const V3_SIGNUP_CTA = { label: 'Start free', to: '/for-hosts/login' } as const;
export const V3_PRICING_CTA = { label: 'See pricing', to: '/for-hosts/pricing' } as const;

/** Real property photography already used across the marketing site. */
export const v3Images = {
  hero: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&q=80',
  marketing: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80',
  listing: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  closing: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1800&q=80',
} as const;

/* ---------------------------------------------------------------- *
 * Hero
 * ---------------------------------------------------------------- */

export const v3Hero = {
  headline: ['Every stay, handled', 'from one place.'],
  lead: 'Bookings, guest chat, rates, and money in one dashboard that keeps working while you are away.',
  secondaryCta: { label: 'Watch the tour', sectionId: 'tour' },
  facts: ['Free to start', 'No card needed', 'Works on your phone'],
  imageAlt: 'Bright serviced apartment living room ready for the next guest',
  reply: {
    question: 'Can we check in at noon?',
    answer: 'Yes, noon works on the 14th. I added it to your booking.',
  },
} as const;

/** Statuses the hero booking card cycles through. Labels match the dashboard workflow. */
export const v3HeroStatuses = [
  { label: 'Pending review', note: 'Form and payment proof in', tone: 'neutral' },
  { label: 'Pending documents', note: 'GAF approved by email', tone: 'amber' },
  { label: 'Ready for check-in', note: 'Stay guide sent', tone: 'teal' },
  { label: 'Completed', note: '₱12,897 posted to finance', tone: 'green' },
] as const;

/* ---------------------------------------------------------------- *
 * Replace statement
 * ---------------------------------------------------------------- */

export const v3Replace = {
  intro: 'Today one booking lives in',
  tools: ['a spreadsheet,', 'the Airbnb app,', 'three Messenger threads,', 'and a receipt folder.'],
  outro: 'Here it lives on one card.',
} as const;

/* ---------------------------------------------------------------- *
 * Pinned workflow
 * ---------------------------------------------------------------- */

export interface V3WorkflowStage {
  status: string;
  title: string;
  body: string;
  needsYou?: boolean;
}

export const v3Workflow = {
  eyebrow: 'How it works',
  title: 'One booking. Six steps. Nothing missed.',
  lead: 'Direct, Airbnb, or walk-in, every booking takes the same path. You step in once.',
  sampleGuest: { name: 'Bea Villareal', initials: 'BV', stay: 'Nov 14 to 17', unit: 'Unit 12F' },
  stages: [
    {
      status: 'Pending review',
      title: 'Review',
      body: 'Form, IDs, and payment proof land on one card. AI checks the receipt. You accept.',
      needsYou: true,
    },
    {
      status: 'Pending documents',
      title: 'Documents',
      body: 'GAF and pet forms fill and send themselves. Parking gets booked. Approvals come back and attach.',
    },
    {
      status: 'Ready for check-in',
      title: 'Check-in',
      body: 'The guest gets a confirmation with check-in details, approved documents, and a stay guide.',
    },
    {
      status: 'Ready for check-out',
      title: 'Stay',
      body: 'The balance is settled at check-in. Before check-out, the guest gets the checklist and refund form.',
    },
    {
      status: 'Pending SD refund',
      title: 'Deposit',
      body: 'The guest sends refund details. A reminder keeps the deposit on time.',
    },
    {
      status: 'Completed',
      title: 'Done',
      body: 'Income posts to finance. The guest is asked for a review and gets a voucher for next time.',
    },
  ] as V3WorkflowStage[],
} as const;

/**
 * Sample content for the animated scene that plays beside each workflow step. Labels only: the
 * step copy on the left does the explaining, the scene shows it happening.
 */
export const v3WorkflowScenes = {
  review: {
    title: 'New booking',
    items: [
      { label: 'Guest form', meta: '3 guests' },
      { label: 'Valid ID', meta: '2 photos' },
      { label: 'Payment proof', meta: '₱3,000' },
    ],
    matched: 'Matched',
    accept: 'Accept',
    accepted: 'Accepted',
  },
  documents: {
    files: ['GAF', 'Parking', 'Pet form'],
    admin: 'Building admin',
    approved: 'Approved',
  },
  checkin: {
    to: 'Bea Villareal',
    sending: 'Sending',
    sent: 'Sent',
    title: "You're all set",
    rows: [
      { label: 'Check-in', value: 'Nov 14, 2 PM' },
      { label: 'Check-out', value: 'Nov 17, 11 AM' },
      { label: 'Unit', value: '12F' },
      { label: 'Guests', value: '3' },
    ],
    attachment: 'Approved GAF',
    cta: 'Open stay guide',
  },
  stay: {
    range: 'Nov 14 to 17',
    days: ['14', '15', '16', '17'],
    phases: ['Check-in day', 'Night 2 of 3', 'Check-out day'],
    events: [
      { title: 'Balance settled', meta: '₱6,000 paid', when: 'Nov 14' },
      { title: 'Check-out email sent', meta: 'Checklist and refund form', when: 'Nov 17' },
    ],
  },
  deposit: {
    amount: '₱3,000',
    reminder: 'Deposit refund due today',
    from: 'You',
    to: 'Bea',
    done: 'Refunded',
  },
  done: {
    finance: 'Finance',
    previous: { name: 'Marco Reyes', meta: 'Nov 7 to 9', amount: '+₱8,450' },
    entry: { name: 'Bea Villareal', meta: 'Nov 14 to 17', amount: '+₱12,897' },
    status: 'Completed',
    trip: { title: 'Thanks for staying', voucher: '₱500 off your next stay' },
  },
} as const;

/* ---------------------------------------------------------------- *
 * Feature bento
 * ---------------------------------------------------------------- */

export const v3Features = {
  eyebrow: 'Features',
  title: 'Run the whole operation',
  bookings: {
    title: 'Bookings',
    body: 'A board for every stage. Bring old bookings in from a spreadsheet and keep Airbnb in sync both ways.',
    tags: ['AI import', 'Airbnb sync', 'Walk-ins'],
  },
  inbox: {
    title: 'Inbox and AI receptionist',
    body: 'Website chat, Facebook, and Instagram in one place. AI drafts or sends replies, and guests can call Kame.',
    guest: 'Ana Lim',
    mode: 'Auto-reply on',
    question: 'Is early check-in possible on the 14th?',
    answer: 'Yes, from 12 PM. Want me to add it to your booking?',
    followUp: 'Yes please, thank you!',
  },
  pricing: {
    title: 'Pricing',
    body: 'Set rates on a calendar, or let Smart Pricing suggest one for every night.',
    suggestion: { label: 'Smart Pricing', value: '+8% Fri' },
    /** Sample week: day, rate in pesos, whether the night is booked. */
    week: [
      { day: 'M', rate: '3.5k', booked: true },
      { day: 'T', rate: '3.5k', booked: true },
      { day: 'W', rate: '3.5k', booked: false },
      { day: 'T', rate: '3.8k', booked: false },
      { day: 'F', rate: '4.6k', booked: true, smart: true },
      { day: 'S', rate: '4.6k', booked: true },
      { day: 'S', rate: '4.3k', booked: false },
    ],
  },
  money: {
    title: 'Finance',
    body: 'Income records itself. Add expenses and export a report.',
    kpiLabel: 'Net this month',
    kpiValue: '₱86,240',
    kpiDelta: '+12%',
    points: [22, 30, 26, 41, 38, 52, 47, 61, 58, 72, 69, 84],
  },
  analytics: {
    title: 'Analytics',
    body: 'Occupancy and rates, with a weekly AI review.',
    occupancy: 82,
    tip: 'Fridays fill 9 days out. Try a higher rate.',
  },
  marketing: {
    title: 'Content Studio',
    body: 'Turn your photos into posts and short videos. Publish to Facebook and Instagram.',
    imageAlt: 'Sunlit bedroom used in a sample Instagram post',
    caption: 'Weekend open at Unit 12F. Book direct and save.',
    modes: ['Post', 'AI photo', 'AI video'],
  },
  team: {
    title: 'Team',
    body: 'Give each person the access they need. Alerts go to Telegram.',
    members: [
      { initials: 'MR', name: 'Mika', role: 'Full Access' },
      { initials: 'JD', name: 'Jon', role: 'Operations' },
      { initials: 'AL', name: 'Ana', role: 'Cleaning' },
    ],
    alert: 'New booking: Bea V., Nov 14 to 17',
  },
} as const;

/* ---------------------------------------------------------------- *
 * Guest side
 * ---------------------------------------------------------------- */

export const v3Guests = {
  eyebrow: 'For your guests',
  title: 'What your guests see',
  lead: 'Your own booking page, a stay guide, and a trip page with chat. No app to install.',
  screens: [
    {
      key: 'book',
      title: 'Book direct',
      body: 'Guests book on your own page. No platform fee.',
    },
    {
      key: 'guide',
      title: 'Stay guide',
      body: 'Check-in time, Wi-Fi, and how to get in.',
    },
    {
      key: 'trip',
      title: 'Trip and chat',
      body: 'Booking status and a direct line to you.',
    },
  ],
  listing: {
    name: 'Azure North 12F',
    place: 'San Fernando, Pampanga',
    rate: '₱3,499',
    nights: '3 nights',
    total: '₱10,497',
    rating: '4.9',
  },
  guide: {
    checkIn: '2:00 PM',
    checkOut: '11:00 AM',
    wifi: { network: 'Kame_12F', password: 'stay2026' },
    steps: ['Show your stay pass at the lobby', 'Take the elevator to 12F', 'Door code: 4821'],
    parking: 'Slot B-14',
  },
  trip: {
    status: 'Ready for check-in',
    progress: 3,
    progressSteps: 5,
    host: 'Mika',
    messages: [
      { from: 'guest', text: 'Hi! Can we check in at 1 PM?' },
      { from: 'host', text: 'Sure, the unit is ready. See you at 1!' },
      { from: 'guest', text: 'Thank you!' },
    ],
  },
} as const;

/* ---------------------------------------------------------------- *
 * Capability index
 * ---------------------------------------------------------------- */

export interface V3Capability {
  label: string;
  body: string;
  icon: LucideIcon;
}

export const v3Capabilities = {
  eyebrow: 'Also included',
  title: 'And everything around it',
  items: [
    { label: 'Maintenance', body: 'Recurring tasks and reminders', icon: Wrench },
    { label: 'Parking', body: 'Rent out spots with their own bookings', icon: Car },
    { label: 'Email templates', body: 'Every guest email in your voice', icon: Mail },
    { label: 'Telegram alerts', body: 'Bookings and messages to your group', icon: Bell },
    { label: 'AI assistant', body: 'Ask about your numbers in plain words', icon: Bot },
    { label: 'Activity log', body: 'Who changed what, and when', icon: Activity },
    { label: 'Copy settings', body: 'Set up one unit, apply to the rest', icon: Copy },
    { label: 'Verified badge', body: 'Stand out in guest search', icon: BadgeCheck },
    { label: 'Vouchers', body: 'Bring past guests back', icon: Ticket },
    {
      label: 'Custom roles',
      body: 'Choose exactly what each role can do',
      icon: SlidersHorizontal,
    },
    { label: 'Phone app', body: 'Install to your home screen', icon: Smartphone },
    { label: 'One bill', body: 'Every property on one plan', icon: Receipt },
  ] as V3Capability[],
} as const;

/* ---------------------------------------------------------------- *
 * Tour, setup, FAQ, closing
 * ---------------------------------------------------------------- */

export const v3Tour = {
  eyebrow: 'Product tour',
  title: 'See it all in three minutes',
  lead: 'A narrated walk through the dashboard. Jump to any part.',
} as const;

export interface V3SetupStep {
  title: string;
  body: string;
  icon: LucideIcon;
}

export const v3Setup = {
  eyebrow: 'Getting started',
  title: 'Set it up once. Then it runs.',
  steps: [
    {
      title: 'Add your units',
      body: 'Create a listing, or upload your booking sheet and let AI map it.',
      icon: FileSpreadsheet,
    },
    {
      title: 'Set your rules',
      body: 'Rates, deposits, forms, and email templates.',
      icon: SlidersHorizontal,
    },
    {
      title: 'Connect channels',
      body: 'Airbnb, Facebook, Instagram, and Telegram.',
      icon: PlugZap,
    },
    {
      title: 'Let it run',
      body: 'Bookings move on their own. You step in when one asks.',
      icon: CalendarClock,
    },
  ] as V3SetupStep[],
} as const;

export const v3Faq = {
  eyebrow: 'FAQ',
  title: 'Questions hosts ask',
  contact: { label: 'Ask us anything', to: '/contact' },
  items: [
    {
      question: 'Do I need a card to start?',
      answer: 'No. Create an account, add a property, and run real bookings on the free plan.',
    },
    {
      question: 'How much does it cost?',
      answer:
        'There is a free plan. Paid plans are priced per property, with one bill for your whole organization. Cancel anytime.',
    },
    {
      question: 'Does it work with Airbnb?',
      answer:
        'Yes. Airbnb reservations come in for review, and your booked and blocked nights go back out.',
    },
    {
      question: 'Can I bring my existing bookings?',
      answer:
        'Yes. Upload your spreadsheet and AI matches the columns. You check everything before it saves.',
    },
    {
      question: 'Can my team use it?',
      answer:
        'Yes. Invite teammates with a built-in or custom role, for the whole organization or one property.',
    },
    {
      question: 'Does it work on my phone?',
      answer: 'Yes. The full dashboard works on your phone and installs to your home screen.',
    },
  ],
} as const;

export const v3Closing = {
  title: 'Run your next booking on Kame Homes.',
  body: 'Start free with one property. Upgrade when it pays for itself.',
  imageAlt: 'Modern vacation home exterior at dusk',
} as const;
