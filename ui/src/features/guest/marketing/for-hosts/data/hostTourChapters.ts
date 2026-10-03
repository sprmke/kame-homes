import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarCheck,
  Building2,
  Clapperboard,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Globe,
  ImagePlus,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Play,
  RefreshCw,
  Rocket,
  Smartphone,
  Tags,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import {
  hostTourNarration,
  hostTourNarrationAudioSrc,
} from '@/features/guest/marketing/for-hosts/data/hostTourNarration';

export const HOST_TOUR_FPS = 30;

/**
 * Narration for each chapter starts this many frames after the chapter begins, so the
 * incoming transition has finished and the previous chapter's voice line has ended.
 */
export const HOST_TOUR_NARRATION_START_DELAY = 14;

export type HostTourTransitionType = 'dissolve' | 'slide' | 'push';

export interface HostTourChapter {
  id: string;
  /** Short chip label (chapter strip, compact player). */
  label: string;
  /** Small line above the on-screen caption. */
  eyebrow: string;
  /** Big on-screen caption, 2–5 words. Carries the story when the tour plays muted. */
  caption: string;
  /** Player readout title + description (under the video). */
  title: string;
  description: string;
  narration: string;
  audioSrc: string;
  icon: LucideIcon;
  /** Intro / outro title cards: no in-scene caption, hidden from the chapter strip. */
  bookend?: boolean;
  /** Scene length in frames — narration length + ~1.8s, so every line has room to land. */
  durationInFrames: number;
  /** Overlap (in frames) of the transition that plays *entering* this chapter. 0 for the first. */
  transitionInFrames: number;
  transitionType: HostTourTransitionType;
}

type ChapterMeta = Omit<HostTourChapter, 'narration' | 'audioSrc'>;

const FADE = 15;
/** Act boundaries: a slightly longer cross-fade. A slide pushes the whole frame ~60px per
 * 30fps step, which reads as a stutter, so every cut is a fade. */
const ACT = 20;

const chapterMeta: ChapterMeta[] = [
  {
    id: 'intro',
    label: 'Intro',
    eyebrow: 'Kame Homes for hosts',
    caption: 'Your rentals, run for you',
    title: 'Everything you need to run your rentals',
    description: 'Bookings, guests, money, marketing, and your team in one workspace.',
    icon: Play,
    bookend: true,
    durationInFrames: 190,
    transitionInFrames: 0,
    transitionType: 'dissolve',
  },
  {
    id: 'setup-guide',
    label: 'Setup',
    eyebrow: 'Setup guide',
    caption: 'Set up in minutes',
    title: 'Set up in minutes',
    description: 'A guided checklist walks you through brand, listings, pricing, and team.',
    icon: ListChecks,
    durationInFrames: 212,
    transitionInFrames: ACT,
    transitionType: 'dissolve',
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    eyebrow: 'Organization dashboard',
    caption: 'Every listing, one view',
    title: 'Every property and parking spot in one view',
    description: 'Revenue and occupancy across your whole organization.',
    icon: Building2,
    durationInFrames: 208,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'command-center',
    label: 'Dashboard',
    eyebrow: 'Property dashboard',
    caption: 'Your day at a glance',
    title: 'Your day at a glance',
    description: 'Earnings, the calendar, and what needs you today.',
    icon: LayoutDashboard,
    durationInFrames: 218,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'booking-workflow',
    label: 'Bookings',
    eyebrow: 'Bookings',
    caption: 'Bookings that run themselves',
    title: 'Bookings that run themselves',
    description: 'Documents, receipt checks, and guest emails happen as each stay moves forward.',
    icon: BookOpen,
    durationInFrames: 234,
    transitionInFrames: ACT,
    transitionType: 'dissolve',
  },
  {
    id: 'bookings-board',
    label: 'Board',
    eyebrow: 'Bookings board',
    caption: 'Drag, drop, done',
    title: 'Drag a booking forward, or add one by hand',
    description: 'A board view for every stage, plus walk-in and phone bookings.',
    icon: KanbanSquare,
    durationInFrames: 205,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'data-import',
    label: 'AI import',
    eyebrow: 'Import',
    caption: 'Import with AI',
    title: 'Bring your bookings over with AI',
    description: 'Upload a spreadsheet. AI matches your columns to the right fields.',
    icon: FileSpreadsheet,
    durationInFrames: 191,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'channel-sync',
    label: 'Airbnb sync',
    eyebrow: 'Channel sync',
    caption: 'Synced with Airbnb',
    title: 'Two-way Airbnb sync',
    description: 'Bookings and blocked dates stay in sync both ways.',
    icon: RefreshCw,
    durationInFrames: 213,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'pricing',
    label: 'Pricing',
    eyebrow: 'Pricing',
    caption: 'Smart Pricing with AI',
    title: 'Rates on a calendar, or Smart Pricing',
    description: 'Set rates by hand, or let AI suggest a rate for every night.',
    icon: Tags,
    durationInFrames: 228,
    transitionInFrames: ACT,
    transitionType: 'dissolve',
  },
  {
    id: 'finance',
    label: 'Finance',
    eyebrow: 'Finance',
    caption: 'Know your real profit',
    title: 'Know your real profit',
    description: 'Income records itself. Add expenses and export a report.',
    icon: DollarSign,
    durationInFrames: 212,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    eyebrow: 'Maintenance',
    caption: 'Upkeep on schedule',
    title: 'Upkeep on schedule',
    description: 'Recurring tasks, reminders, and a clear done list.',
    icon: Wrench,
    durationInFrames: 186,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    eyebrow: 'Analytics',
    caption: 'Insights, explained',
    title: 'Analytics with an AI review',
    description: 'Occupancy, rates, and guests, plus clear tips on what to improve.',
    icon: BarChart3,
    durationInFrames: 205,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'guest-inbox',
    label: 'Inbox',
    eyebrow: 'Guest inbox',
    caption: 'One inbox, AI replies',
    title: 'One inbox with AI replies',
    description: 'Facebook, Instagram, and website chat together. AI drafts every reply.',
    icon: Inbox,
    durationInFrames: 238,
    transitionInFrames: ACT,
    transitionType: 'dissolve',
  },
  {
    id: 'ai-receptionist',
    label: 'AI receptionist',
    eyebrow: 'Voice receptionist',
    caption: 'An AI receptionist',
    title: 'An AI receptionist for your guests',
    description: 'Guests call Kame and get answers about your place, day or night.',
    icon: PhoneCall,
    durationInFrames: 243,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'public-pages',
    label: 'Public pages',
    eyebrow: 'Public pages',
    caption: 'Pages that sell',
    title: 'Pages that update as you type',
    description: 'Listing, stay guide, and showcase page with a live preview.',
    icon: Globe,
    durationInFrames: 195,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'guest-booking',
    label: 'Book direct',
    eyebrow: 'Guest booking page',
    caption: 'Guests book direct',
    title: 'Your own booking page',
    description:
      'Guests find you in search, see your photos and reviews, pick open dates, and book.',
    icon: CalendarCheck,
    durationInFrames: 240,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'guest-journey',
    label: 'Guest stay',
    eyebrow: 'Guest experience',
    caption: 'From check-in to review',
    title: 'A guided stay for every guest',
    description: 'Stay guide, chat with you, then a review and a voucher for their next stay.',
    icon: Smartphone,
    durationInFrames: 240,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'templates',
    label: 'Templates',
    eyebrow: 'Templates',
    caption: 'Emails in your voice',
    title: 'Guest emails in your voice',
    description: 'Edit every email and preview exactly what guests receive.',
    icon: FileText,
    durationInFrames: 189,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'marketing-studio',
    label: 'Content Studio',
    eyebrow: 'Marketing',
    caption: 'Content Studio',
    title: 'Calendars, posts, and videos',
    description: 'Make marketing content for your property and publish to Facebook and Instagram.',
    icon: Megaphone,
    durationInFrames: 211,
    transitionInFrames: ACT,
    transitionType: 'dissolve',
  },
  {
    id: 'ai-photo',
    label: 'AI photos',
    eyebrow: 'AI Studio',
    caption: 'AI photos and posts',
    title: 'AI photos and posts from your own photos',
    description: 'Describe a shot, add your photos, and get images that look like your place.',
    icon: ImagePlus,
    durationInFrames: 240,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'ai-video',
    label: 'AI video',
    eyebrow: 'AI Studio',
    caption: 'Photos into video',
    title: 'Turn a photo into a video clip',
    description: 'Pick a photo and a camera move. AI makes a short clip.',
    icon: Clapperboard,
    durationInFrames: 228,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'team',
    label: 'Team',
    eyebrow: 'Team',
    caption: 'Your team, your rules',
    title: 'Your team, your rules',
    description: 'Invite people and choose what each person can see and do.',
    icon: Users,
    durationInFrames: 194,
    transitionInFrames: ACT,
    transitionType: 'dissolve',
  },
  {
    id: 'notifications',
    label: 'Alerts',
    eyebrow: 'Notifications',
    caption: 'Alerts in Telegram',
    title: 'Instant alerts in Telegram',
    description: 'Bookings, messages, and maintenance sent to the right group.',
    icon: Bell,
    durationInFrames: 188,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'ai-mode',
    label: 'AI mode',
    eyebrow: 'AI mode',
    caption: 'Just ask',
    title: 'Ask, and the right page opens',
    description: 'Chat in plain words. Answers use your live data and open the page beside you.',
    icon: MessageSquare,
    durationInFrames: 222,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'plans-billing',
    label: 'Plans',
    eyebrow: 'Plans & billing',
    caption: 'Simple, fair pricing',
    title: 'Simple plans, one bill',
    description: 'Priced per property, with one bill for the whole organization.',
    icon: CreditCard,
    durationInFrames: 208,
    transitionInFrames: FADE,
    transitionType: 'dissolve',
  },
  {
    id: 'outro',
    label: 'Start free',
    eyebrow: 'Kame Homes',
    caption: 'Start free today',
    title: 'Start free today',
    description: 'Set up your first property in minutes.',
    icon: Rocket,
    bookend: true,
    durationInFrames: 225,
    transitionInFrames: ACT,
    transitionType: 'dissolve',
  },
];

const narrationById = Object.fromEntries(hostTourNarration.map((line) => [line.id, line.text]));

export const hostTourChapters: HostTourChapter[] = chapterMeta.map((chapter) => {
  const narration = narrationById[chapter.id];
  if (!narration) {
    throw new Error(`Missing narration for host tour chapter "${chapter.id}"`);
  }
  return {
    ...chapter,
    narration,
    audioSrc: hostTourNarrationAudioSrc(chapter.id),
  };
});

/** Feature chapters only (no intro/outro) — the "N features" count used in page copy. */
export const HOST_TOUR_FEATURE_COUNT = hostTourChapters.filter(
  (chapter) => !chapter.bookend
).length;

/** Per-chapter scene length, in frames. */
export const HOST_TOUR_CHAPTER_DURATIONS: number[] = hostTourChapters.map(
  (chapter) => chapter.durationInFrames
);

/** Per-chapter entering-transition overlap, in frames (index 0 is 0). */
export const HOST_TOUR_CHAPTER_TRANSITIONS: number[] = hostTourChapters.map(
  (chapter) => chapter.transitionInFrames
);

/**
 * Cumulative start frame of each chapter on the composition timeline, accounting for
 * `TransitionSeries` overlap: `start[i] = start[i-1] + duration[i-1] - transition[i]`.
 */
export const HOST_TOUR_CHAPTER_STARTS: number[] = hostTourChapters.reduce<number[]>(
  (starts, chapter, index) => {
    if (index === 0) {
      starts.push(0);
      return starts;
    }
    const previousStart = starts[index - 1];
    const previousDuration = hostTourChapters[index - 1].durationInFrames;
    starts.push(previousStart + previousDuration - chapter.transitionInFrames);
    return starts;
  },
  []
);

/** Total composition length: sum of scene durations minus all transition overlaps. */
export const HOST_TOUR_DURATION_IN_FRAMES =
  HOST_TOUR_CHAPTER_DURATIONS.reduce((total, frames) => total + frames, 0) -
  HOST_TOUR_CHAPTER_TRANSITIONS.reduce((total, frames) => total + frames, 0);

/** Index of the chapter that owns a given frame (last chapter whose start is at or before it). */
export function hostTourChapterIndexAtFrame(frame: number): number {
  let index = 0;
  for (let i = 0; i < HOST_TOUR_CHAPTER_STARTS.length; i += 1) {
    if (HOST_TOUR_CHAPTER_STARTS[i] <= frame) {
      index = i;
    } else {
      break;
    }
  }
  return index;
}
