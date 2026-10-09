import {
  BarChart3,
  Bell,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CircleCheck,
  CreditCard,
  Database,
  Eye,
  FileCheck2,
  FileDown,
  Gift,
  ImagePlus,
  Inbox,
  LayoutTemplate,
  Lightbulb,
  Link,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  PenLine,
  Plus,
  ReceiptText,
  RefreshCw,
  ScanLine,
  ScrollText,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareParking,
  Star,
  Timer,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * Per-feature kit copy. Every module gets:
 * - a hook: the pain as a question (3-line tall break, 2-line wide break), then the answer;
 * - three "how it works" steps for the carousel.
 * Rules: plain words, product-true, no hype, no em dashes. Sample names stay in the UI.
 */
export interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface FeatureKit {
  hook: string[];
  hookWide: string[];
  answer: string;
  steps: [Step, Step, Step];
}

const s = (icon: LucideIcon, title: string, text: string): Step => ({ icon, title, text });

export const kitCopy: Record<string, FeatureKit> = {
  '01-bookings': {
    hook: ['Still moving', 'every booking', 'by hand?'],
    hookWide: ['Still moving every', 'booking by hand?'],
    answer: 'Kame moves each stay to the next step for you.',
    steps: [
      s(FileCheck2, 'Guest books', 'Form, ID and payment come in through your booking link.'),
      s(ScanLine, 'Kame checks', 'The receipt and building approval are matched to the booking.'),
      s(Mail, 'Guest is ready', 'The check-in email goes out and you get a notification.'),
    ],
  },
  '02-receipt-check': {
    hook: ['How many', 'receipts did you', 'zoom into today?'],
    hookWide: ['How many receipts', 'did you zoom into?'],
    answer: 'AI reads each one and matches it to the booking.',
    steps: [
      s(Upload, 'Guest uploads', 'They add the payment receipt to their booking.'),
      s(ScanLine, 'AI reads it', 'Amount, reference number and date are checked.'),
      s(
        CircleCheck,
        'Booking moves on',
        'A match moves the stay forward. Anything off waits for you.'
      ),
    ],
  },
  '03-channel-sync': {
    hook: ['Sold the', 'same night', 'twice?'],
    hookWide: ['Sold the same', 'night twice?'],
    answer: 'Two-way sync with Airbnb, Booking.com and Vrbo.',
    steps: [
      s(Link, 'Paste your link', 'Add the calendar link from each channel.'),
      s(RefreshCw, 'Sync both ways', 'Bookings and blocked dates flow in and out.'),
      s(CalendarCheck, 'One calendar', 'Every booking in one view, on your phone.'),
    ],
  },
  '04-smart-pricing': {
    hook: ['Same rate', 'on a holiday', 'weekend?'],
    hookWide: ['Same rate on a', 'holiday weekend?'],
    answer: 'Get a suggested rate for every night.',
    steps: [
      s(SlidersHorizontal, 'Set your rules', 'Base rate, a floor, weekend and last-minute rules.'),
      s(Sparkles, 'Rates suggested', 'Each night gets a rate based on demand and dates.'),
      s(CircleCheck, 'Review or autopilot', 'Apply them yourself, or let autopilot run nightly.'),
    ],
  },
  '05-ai-receptionist': {
    hook: ['Same question,', 'tenth time', 'today?'],
    hookWide: ['Same question,', 'tenth time today?'],
    answer: 'Guests can talk to your AI receptionist instead.',
    steps: [
      s(MessageCircle, 'Guest taps Talk', 'They start a voice chat from your chat page.'),
      s(Mic, 'They ask out loud', 'Parking, check-in, house rules, in their own words.'),
      s(
        Inbox,
        'Answered and saved',
        'Answers come from your house guide. The transcript lands in your inbox.'
      ),
    ],
  },
  '06-booking-site': {
    hook: ['Paying fees', 'on repeat', 'guests?'],
    hookWide: ['Paying fees on', 'repeat guests?'],
    answer: 'Send them to your own booking page.',
    steps: [
      s(LayoutTemplate, 'Pick a template', 'Your photos, rates and rules on your own page.'),
      s(CalendarDays, 'Live dates and prices', 'Guests see what is open and what it costs.'),
      s(CreditCard, 'Guests book direct', 'The guest form and payment are built in.'),
    ],
  },
  '07-content-studio': {
    hook: ['No time to', 'post about', 'your place?'],
    hookWide: ['No time to post', 'about your place?'],
    answer: 'Turn your photos into a post in minutes.',
    steps: [
      s(ImagePlus, 'Add your photos', 'Start from the photos you already have.'),
      s(PenLine, 'Describe the post', 'Say what it is for. AI writes and lays it out.'),
      s(Send, 'Publish', 'Post to Facebook and Instagram from the dashboard.'),
    ],
  },
  '08-insights': {
    hook: ['Is your', 'occupancy', 'up or down?'],
    hookWide: ['Is your occupancy', 'up or down?'],
    answer: 'See it at a glance, with tips on what to change.',
    steps: [
      s(BarChart3, 'Occupancy and rates', 'How full you are and what you earn per night.'),
      s(TrendingUp, 'Trends over time', 'Compare months and spot slow weeks early.'),
      s(Lightbulb, 'Plain tips', 'Suggestions on what to improve next.'),
    ],
  },
  '09-team': {
    hook: ['Sharing one', 'login with', 'your cleaner?'],
    hookWide: ['Sharing one login', 'with your cleaner?'],
    answer: 'Give each person their own access.',
    steps: [
      s(UserPlus, 'Invite by email', 'Add cleaners, co-hosts and staff.'),
      s(ShieldCheck, 'Pick a role', 'Use a built-in role or choose each permission.'),
      s(Eye, 'They see their part', 'Each person sees only what their role allows.'),
    ],
  },
  '10-maintenance': {
    hook: ['When was', 'the aircon', 'last cleaned?'],
    hookWide: ['When was the aircon', 'last cleaned?'],
    answer: 'Recurring tasks with reminders, for every unit.',
    steps: [
      s(Wrench, 'Add a task', 'Say what it is and how often it repeats.'),
      s(UserCheck, 'Assign it', 'Pick who does it and for which unit.'),
      s(Bell, 'Get reminded', 'Reminders go out on time. Mark it done when finished.'),
    ],
  },
  '11-telegram-alerts': {
    hook: ['Team missed', 'the new booking', 'again?'],
    hookWide: ['Team missed the', 'new booking again?'],
    answer: 'Alerts go straight to your Telegram groups.',
    steps: [
      s(Send, 'Connect Telegram', 'Link your team groups in settings.'),
      s(ListChecks, 'Pick the events', 'New bookings, guest messages, maintenance.'),
      s(BellRing, 'Right group, right away', 'Each alert goes to the group that needs it.'),
    ],
  },
  '12-ai-mode': {
    hook: ['What did', 'you earn', 'last month?'],
    hookWide: ['What did you earn', 'last month?'],
    answer: 'Ask Kame. It answers from your real numbers.',
    steps: [
      s(MessageSquare, 'Ask in plain words', '"How did October compare to September?"'),
      s(Database, 'It reads your data', 'Bookings, finance and calendar, live.'),
      s(BarChart3, 'Get a clear answer', 'The numbers, a short summary and a chart.'),
    ],
  },
  '13-stay-guide': {
    hook: ['Guests texting', '"What\'s the', 'Wi-Fi?"'],
    hookWide: ['Guests texting', '"What\'s the Wi-Fi?"'],
    answer: 'Send one guide with everything they need.',
    steps: [
      s(LayoutTemplate, 'Pick a template', 'Six designs. Set the colors, fonts and sections.'),
      s(ScrollText, 'Add your details', 'Check-in steps, house rules, parking and Wi-Fi.'),
      s(Send, 'It sends itself', 'The link goes out when the booking is ready for check-in.'),
    ],
  },
  '14-deposit-refund': {
    hook: ['Chasing', 'guests for', 'refund details?'],
    hookWide: ['Chasing guests for', 'refund details?'],
    answer: 'Guests fill in a short form after checkout.',
    steps: [
      s(Star, 'They leave a review', 'Stars and quick tags, right in the form.'),
      s(Gift, 'They get a voucher', 'A thank-you they can use on their next stay.'),
      s(Wallet, 'They pick the refund', 'GCash, bank or cash pickup. You see it on the booking.'),
    ],
  },
  '15-parking': {
    hook: ['Parking slot', 'empty all', 'week?'],
    hookWide: ['Parking slot', 'empty all week?'],
    answer: 'List it and take requests from nearby guests.',
    steps: [
      s(SquareParking, 'List your slot', 'Set your rate and when it is free.'),
      s(Timer, 'Accept a request', 'Requests come with a timer. Accept in one tap.'),
      s(Mail, 'Guest pays, PMO told', 'The endorsement email goes out for you.'),
    ],
  },
  '16-guest-inbox': {
    hook: ['Three apps', 'open to answer', 'one guest?'],
    hookWide: ['Three apps open to', 'answer one guest?'],
    answer: 'Every message in one inbox, with a reply drafted.',
    steps: [
      s(Inbox, 'One inbox', 'Messenger, Instagram and web chat together.'),
      s(Sparkles, 'Reply drafted', 'AI writes a reply from your house info.'),
      s(Send, 'Send or edit', 'Check it, change it, send it.'),
    ],
  },
  '17-finance': {
    hook: ['Do you know', 'your real', 'profit?'],
    hookWide: ['Do you know', 'your real profit?'],
    answer: 'Income records itself. Add expenses, see what is left.',
    steps: [
      s(ReceiptText, 'Income from bookings', 'Every paid booking is recorded on its own.'),
      s(Plus, 'Add expenses', 'Cleaning, repairs and bills, recurring if needed.'),
      s(FileDown, 'Export the report', 'A monthly PDF ready to share or file.'),
    ],
  },
};
