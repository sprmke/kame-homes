/** Per-chapter voiceover lines for the Remotion host dashboard tour. Short, plain, one idea each. */
export const HOST_TOUR_NARRATION_PUBLIC_DIR = '/marketing/for-hosts/narration';

export const hostTourNarration = [
  {
    id: 'intro',
    text: 'Meet Kame Homes. Everything you need to run your rentals, in one place.',
  },
  {
    id: 'setup-guide',
    text: 'Setup takes minutes. A guided checklist walks you through every step.',
  },
  {
    id: 'portfolio',
    text: 'See all your properties and parking spots together, with revenue and occupancy.',
  },
  {
    id: 'command-center',
    text: 'Each property gets a simple home page: earnings, your calendar, and what needs you today.',
  },
  {
    id: 'booking-workflow',
    text: 'Bookings move forward on their own. Documents, receipts, and guest emails are handled for you.',
  },
  {
    id: 'bookings-board',
    text: 'Prefer a board? Drag a booking to its next step, or add one by hand.',
  },
  {
    id: 'data-import',
    text: 'Moving from a spreadsheet? Upload it, and AI fills in the right fields.',
  },
  {
    id: 'channel-sync',
    text: 'Connect Airbnb once. Bookings and blocked dates stay in sync both ways.',
  },
  {
    id: 'pricing',
    text: 'Set your rates on a calendar, or turn on Smart Pricing and let AI suggest them.',
  },
  {
    id: 'finance',
    text: 'Income is recorded automatically. Add expenses and see your real profit.',
  },
  {
    id: 'maintenance',
    text: 'Schedule upkeep, get reminders, and check off tasks as you go.',
  },
  {
    id: 'analytics',
    text: 'Analytics shows how you are doing, and an AI review tells you what to improve.',
  },
  {
    id: 'guest-inbox',
    text: 'Facebook, Instagram, and website chat land in one inbox. AI drafts the replies.',
  },
  {
    id: 'ai-receptionist',
    text: 'Guests can call Kame, your AI receptionist. It answers questions about your place, day or night.',
  },
  {
    id: 'public-pages',
    text: 'Your listing, stay guide, and showcase page update live as you edit.',
  },
  {
    id: 'guest-booking',
    text: 'Guests find you in search or on your own page, pick open dates, and book in a few taps.',
  },
  {
    id: 'guest-journey',
    text: 'Once booked, guests get a stay guide, chat with you anytime, and earn a voucher when they leave a review.',
  },
  {
    id: 'templates',
    text: 'Customize every guest email, and preview exactly what guests will see.',
  },
  {
    id: 'marketing-studio',
    text: 'Content Studio makes calendars, social posts, and short videos for your property.',
  },
  {
    id: 'ai-photo',
    text: 'Describe a shot, add your photos, and AI creates posts and images that look like your place.',
  },
  {
    id: 'ai-video',
    text: 'Pick a photo and a camera move. AI turns it into a short video clip.',
  },
  {
    id: 'team',
    text: 'Invite your team, and choose exactly what each person can see and do.',
  },
  {
    id: 'notifications',
    text: 'Get instant Telegram alerts for bookings, messages, and maintenance.',
  },
  {
    id: 'ai-mode',
    text: 'Switch to AI mode, ask in plain words, and the right page opens beside the chat.',
  },
  {
    id: 'plans-billing',
    text: 'Simple plans, priced per property, with one bill for your whole organization.',
  },
  {
    id: 'outro',
    text: 'Kame Homes. Less busywork, more happy guests. Start free today.',
  },
] as const;

export type HostTourNarrationId = (typeof hostTourNarration)[number]['id'];

export function hostTourNarrationAudioSrc(id: string): string {
  return `${HOST_TOUR_NARRATION_PUBLIC_DIR}/${id}.mp3`;
}
